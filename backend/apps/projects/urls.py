from django.urls import path

from .views import (
    ProjectDetailView,
    ProjectListCreateView,
    PromptDetailView,
    PromptListCreateView,
)

urlpatterns = [
    path("", ProjectListCreateView.as_view(), name="project-list"),
    path("<uuid:pk>/", ProjectDetailView.as_view(), name="project-detail"),
    path(
        "<uuid:project_id>/prompts/",
        PromptListCreateView.as_view(),
        name="prompt-list",
    ),
    path(
        "<uuid:project_id>/prompts/<uuid:pk>/",
        PromptDetailView.as_view(),
        name="prompt-detail",
    ),
]