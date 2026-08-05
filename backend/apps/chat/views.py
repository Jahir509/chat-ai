from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.response import Response

from apps.llm.client import generate_reply
from apps.projects.models import Project

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    SendMessageSerializer,
)

HISTORY_LIMIT = 20  # messages sent as context


@extend_schema(tags=["chat"])
class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer

    def get_project(self):
        return get_object_or_404(
            Project, pk=self.kwargs["project_id"], owner=self.request.user
        )

    def get_queryset(self):
        return Conversation.objects.filter(project=self.get_project())

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())


@extend_schema(tags=["chat"])
class ConversationDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(project__owner=self.request.user)


@extend_schema_view(
    get=extend_schema(tags=["chat"], summary="Conversation history"),
    post=extend_schema(
        tags=["chat"],
        summary="Send a message and get the agent's reply",
        request=SendMessageSerializer,
        responses={201: MessageSerializer(many=True)},
    ),
)
class MessageListCreateView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == "POST":
            return SendMessageSerializer
        return MessageSerializer

    def get_conversation(self):
        return get_object_or_404(
            Conversation.objects.select_related("project"),
            pk=self.kwargs["conversation_id"],
            project__owner=self.request.user,
        )

    def get_queryset(self):
        return Message.objects.filter(conversation=self.get_conversation())

    def create(self, request, *args, **kwargs):
        conversation = self.get_conversation()
        project = conversation.project

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text = serializer.validated_data["content"]

        # Newest N rows via SQL LIMIT, then flipped back to chronological.
        history = list(
            conversation.messages.order_by("-created_at")
            .values("role", "content")[:HISTORY_LIMIT]
        )[::-1]

        user_msg = Message.objects.create(
            conversation=conversation, role="user", content=text
        )

        # Deliberately outside a transaction: this blocks for seconds and
        # must not hold a DB connection. On failure the user's message
        # survives, so they can retry without retyping.
        reply, in_tok, out_tok, response_id = generate_reply(
            project=project, history=history, user_text=text
        )

        assistant_msg = Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=reply,
            input_tokens=in_tok,
            output_tokens=out_tok,
            response_id=response_id,
        )

        if not conversation.title:
            conversation.title = text[:60]
        conversation.save(update_fields=["title", "updated_at"])

        return Response(
            MessageSerializer([user_msg, assistant_msg], many=True).data,
            status=status.HTTP_201_CREATED,
        )