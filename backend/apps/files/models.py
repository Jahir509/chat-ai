import uuid

from django.db import models

from apps.projects.models import Project


class ProjectFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="files")
    filename = models.CharField(max_length=255)
    size = models.PositiveIntegerField()
    openai_file_id = models.CharField(max_length=80)
    # in_progress | completed | failed | cancelled
    status = models.CharField(max_length=20, default="in_progress")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_files"
        ordering = ("-created_at",)

    def __str__(self):
        return self.filename