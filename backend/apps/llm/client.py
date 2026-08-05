import logging

from django.conf import settings
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
    RateLimitError,
)
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

_client = None


def get_client():
    """One client per process — reuses the HTTP connection pool."""
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise APIException("OPENAI_API_KEY is not configured.")
        _client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=60.0, max_retries=2)
    return _client


class LLMUnavailable(APIException):
    status_code = 503
    default_detail = "The model is temporarily unavailable. Please try again."


def generate_reply(*, project, history, user_text):
    """
    history: [{"role": "user"|"assistant", "content": str}, ...]
    Returns (text, input_tokens, output_tokens, response_id)
    """
    kwargs = {
        "model": project.model,
        "input": history + [{"role": "user", "content": user_text}],
        "store": False,
    }

    instructions = project.build_instructions()
    if instructions:
        kwargs["instructions"] = instructions

    # Some newer models reject an explicit non-default temperature.
    if project.temperature != 1.0:
        kwargs["temperature"] = project.temperature

    if project.vector_store_id:
        kwargs["tools"] = [
            {"type": "file_search", "vector_store_ids": [project.vector_store_id]}
        ]

    try:
        logger.info("=== OpenAI request ===")
        logger.info("model: %s", kwargs["model"])
        logger.info("instructions: %r", kwargs.get("instructions"))
        logger.info("history: %s messages", len(kwargs["input"]))
        for m in kwargs["input"]:
            logger.info("  %s: %s", m["role"], m["content"][:60])
        logger.info("tools: %s", kwargs.get("tools"))

        r = get_client().responses.create(**kwargs)
    except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
        logger.warning("OpenAI transient failure: %s", exc)
        raise LLMUnavailable() from exc
    except APIStatusError as exc:
        logger.error("OpenAI rejected request: %s", exc)
        raise APIException(f"Model request failed: {exc.message}") from exc

    usage = r.usage
    return r.output_text, usage.input_tokens, usage.output_tokens, r.id


def ensure_vector_store(project):
    """Create the project's vector store on first upload."""
    if project.vector_store_id:
        return project.vector_store_id
    vs = get_client().vector_stores.create(name=f"project-{project.id}")
    project.vector_store_id = vs.id
    project.save(update_fields=["vector_store_id"])
    return vs.id


def upload_and_attach(project, django_file):
    """Upload to OpenAI, attach to the vector store. Returns (file_id, status)."""
    client = get_client()
    try:
        uploaded = client.files.create(
            file=(django_file.name, django_file.file), purpose="assistants"
        )
        vs_id = ensure_vector_store(project)
        vs_file = client.vector_stores.files.create(
            vector_store_id=vs_id, file_id=uploaded.id
        )
    except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
        logger.warning("Upload transient failure: %s", exc)
        raise LLMUnavailable() from exc
    except APIStatusError as exc:
        logger.error("Upload rejected: %s", exc)
        raise APIException(f"Upload failed: {exc.message}") from exc
    return uploaded.id, vs_file.status


def vector_store_file_status(project, file_id):
    """in_progress | completed | failed | cancelled, or None if undeterminable."""
    if not project.vector_store_id:
        logger.error("Project %s has files but no vector store", project.id)
        return "failed"
    try:
        vs_file = get_client().vector_stores.files.retrieve(
            vector_store_id=project.vector_store_id, file_id=file_id
        )
        logger.info(
            "vector store file %s status=%s error=%s",
            file_id, vs_file.status, getattr(vs_file, "last_error", None),
        )
        return vs_file.status
    except APIStatusError as exc:
        if exc.status_code == 404:
            logger.warning("File %s not in vector store", file_id)
            return "failed"
        logger.error("Status check failed for %s: %s", file_id, exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Status check errored for %s: %s", file_id, exc)
        return None

def delete_remote_file(project, file_id):
    """Detach from the vector store and delete the file. Best-effort."""
    client = get_client()
    if project.vector_store_id:
        try:
            client.vector_stores.files.delete(
                vector_store_id=project.vector_store_id, file_id=file_id
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Detach failed for %s: %s", file_id, exc)
    try:
        client.files.delete(file_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Remote delete failed for %s: %s", file_id, exc)