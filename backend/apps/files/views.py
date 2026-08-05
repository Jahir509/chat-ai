from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.llm.client import (
    delete_remote_file,
    upload_and_attach,
    vector_store_file_status,
)
from apps.projects.models import Project

from .models import ProjectFile
from .serializers import FileUploadSerializer, ProjectFileSerializer

from datetime import timedelta
from django.utils import timezone

PENDING = ("in_progress", None, "")
STALE_AFTER = timedelta(minutes=5)

@extend_schema_view(
    get=extend_schema(tags=["files"], summary="List project files"),
    post=extend_schema(
        tags=["files"],
        summary="Upload a file into the project",
        request={"multipart/form-data": FileUploadSerializer},
        responses={201: ProjectFileSerializer},
    ),
)
class FileListCreateView(generics.ListCreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_serializer_class(self):
        return FileUploadSerializer if self.request.method == "POST" else ProjectFileSerializer

    def get_project(self):
        return get_object_or_404(
            Project, pk=self.kwargs["project_id"], owner=self.request.user
        )

    def get_queryset(self):
        return ProjectFile.objects.filter(project=self.get_project())

    def list(self, request, *args, **kwargs):
        project = self.get_project()
        files = list(ProjectFile.objects.filter(project=project))

        for f in files:
            if f.status != "in_progress":
                continue
            fresh = vector_store_file_status(project, f.openai_file_id)
            if fresh in (None, "in_progress") and \
                    timezone.now() - f.created_at > STALE_AFTER:
                fresh = "failed"
            if fresh and fresh != f.status:
                f.status = fresh
                f.save(update_fields=["status"])

        return Response(ProjectFileSerializer(files, many=True).data)

    def create(self, request, *args, **kwargs):
        project = self.get_project()
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]

        file_id, vs_status = upload_and_attach(project, upload)

        record = ProjectFile.objects.create(
            project=project,
            filename=upload.name,
            size=upload.size,
            openai_file_id=file_id,
            status=vs_status or "in_progress",
        )
        return Response(
            ProjectFileSerializer(record).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["files"], summary="Delete a project file")
class FileDeleteView(generics.DestroyAPIView):
    serializer_class = ProjectFileSerializer

    def get_queryset(self):
        return ProjectFile.objects.filter(
            project__pk=self.kwargs["project_id"],
            project__owner=self.request.user,
        )

    def perform_destroy(self, instance):
        delete_remote_file(instance.project, instance.openai_file_id)
        instance.delete()