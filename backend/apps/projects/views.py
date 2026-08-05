from django.shortcuts import get_object_or_404
from rest_framework import generics

from .models import Project, Prompt
from .serializers import ProjectSerializer, PromptSerializer


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)


class PromptListCreateView(generics.ListCreateAPIView):
    serializer_class = PromptSerializer

    def get_project(self):
        return get_object_or_404(
            Project, pk=self.kwargs["project_id"], owner=self.request.user
        )

    def get_queryset(self):
        return Prompt.objects.filter(project=self.get_project())

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())


class PromptDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PromptSerializer

    def get_queryset(self):
        return Prompt.objects.filter(
            project__pk=self.kwargs["project_id"],
            project__owner=self.request.user,
        )