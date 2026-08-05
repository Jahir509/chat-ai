from rest_framework import serializers

from .models import ProjectFile

MAX_BYTES = 20 * 1024 * 1024
ALLOWED = {
    ".pdf", ".txt", ".md", ".docx", ".doc", ".pptx", ".csv",
    ".json", ".html", ".py", ".js", ".ts",
}


class ProjectFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectFile
        fields = ("id", "filename", "size", "status", "created_at")
        read_only_fields = fields


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, f):
        if f.size > MAX_BYTES:
            raise serializers.ValidationError("File must be 20 MB or smaller.")
        if not any(f.name.lower().endswith(ext) for ext in ALLOWED):
            raise serializers.ValidationError(
                f"Unsupported type. Allowed: {', '.join(sorted(ALLOWED))}"
            )
        return f