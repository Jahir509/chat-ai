from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = (
            "id", "role", "content", "input_tokens", "output_tokens", "created_at",
        )
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "title", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=8000, trim_whitespace=True)