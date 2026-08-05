import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    model = models.CharField(max_length=60, default=settings.OPENAI_DEFAULT_MODEL)
    temperature = models.FloatField(default=1.0)
    # Set lazily on first file upload; here now so files/ needs no migration.
    vector_store_id = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("owner", "name"), name="unique_project_name_per_owner"
            )
        ]

    def __str__(self):
        return self.name

    def build_instructions(self):
        """Concatenate active system prompts into one instructions string."""
        parts = self.prompts.filter(is_active=True, role="system").values_list(
            "content", flat=True
        )
        return "\n\n".join(parts)


class Prompt(models.Model):
    ROLE_CHOICES = (("system", "System"), ("user", "User"))

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="prompts"
    )
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="system")
    content = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "prompts"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.project.name} / {self.name}"