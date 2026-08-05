import { useEffect, useState } from "react";
import api, { apiError, listOf } from "../api/client";
import { Button, Card, ErrorBox, Input, Spinner, Textarea } from "../ui";

export default function PromptsPanel({ projectId }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", content: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/prompts/`)
      .then(({ data }) => setPrompts(listOf(data)))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post(`/projects/${projectId}/prompts/`, {
        ...form,
        role: "system",
      });
      setPrompts((prev) => [...prev, data]);
      setForm({ name: "", content: "" });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p) {
    try {
      const { data } = await api.patch(`/projects/${projectId}/prompts/${p.id}/`, {
        is_active: !p.is_active,
      });
      setPrompts((prev) => prev.map((x) => (x.id === p.id ? data : x)));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function saveContent(p, content) {
    try {
      const { data } = await api.patch(`/projects/${projectId}/prompts/${p.id}/`, {
        content,
      });
      setPrompts((prev) => prev.map((x) => (x.id === p.id ? data : x)));
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function remove(id) {
    const previous = prompts;
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.delete(`/projects/${projectId}/prompts/${id}/`);
    } catch (err) {
      setPrompts(previous);
      setError(apiError(err));
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBox>{error}</ErrorBox>

      <Card>
        <h3 className="mb-3 font-medium text-slate-900">Add system prompt</h3>
        <form onSubmit={create} className="space-y-3">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Persona"
          />
          <Textarea
            label="Content"
            required
            rows={4}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="You are a concise support agent. Never invent product features."
          />
          <Button type="submit" disabled={saving}>
            {saving && <Spinner className="h-4 w-4" />}
            Add prompt
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            No prompts yet. Without one, the agent has no instructions.
          </p>
        </Card>
      ) : (
        prompts.map((p) => <PromptRow key={p.id} p={p} {...{ toggle, saveContent, remove }} />)
      )}
    </div>
  );
}

function PromptRow({ p, toggle, saveContent, remove }) {
  const [content, setContent] = useState(p.content);
  const dirty = content !== p.content;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-medium text-slate-900">{p.name}</h4>
          <span
            className={`text-xs ${p.is_active ? "text-emerald-600" : "text-slate-400"}`}
          >
            {p.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={() => toggle(p)}>
            {p.is_active ? "Disable" : "Enable"}
          </Button>
          <Button variant="danger" onClick={() => remove(p.id)}>
            Delete
          </Button>
        </div>
      </div>

      <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} />

      {dirty && (
        <div className="mt-2 flex gap-2">
          <Button onClick={() => saveContent(p, content)}>Save</Button>
          <Button variant="ghost" onClick={() => setContent(p.content)}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
}