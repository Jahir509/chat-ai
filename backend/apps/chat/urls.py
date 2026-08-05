from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    MessageListCreateView,
)

urlpatterns = [
    path(
        "projects/<uuid:project_id>/conversations/",
        ConversationListCreateView.as_view(),
        name="conversation-list",
    ),
    path(
        "conversations/<uuid:pk>/",
        ConversationDetailView.as_view(),
        name="conversation-detail",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        MessageListCreateView.as_view(),
        name="message-list",
    ),
]