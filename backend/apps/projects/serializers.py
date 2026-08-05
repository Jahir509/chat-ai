from rest_framework import serializers

from .models import Project, Prompt


class PromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prompt
        fields = (
            "id", "name", "role", "content", "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ProjectSerializer(serializers.ModelSerializer):
    prompt_count = serializers.IntegerField(source="prompts.count", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id", "name", "description", "model", "temperature",
            "prompt_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "prompt_count", "created_at", "updated_at")

    def validate_name(self, value):
        user = self.context["request"].user
        qs = Project.objects.filter(owner=user, name=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "You already have a project with this name."
            )
        return value

    def validate_temperature(self, value):
        if not 0 <= value <= 2:
            raise serializers.ValidationError("Must be between 0 and 2.")
        return value