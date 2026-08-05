from django.urls import path

from .views import FileDeleteView, FileListCreateView

urlpatterns = [
    path(
        "<uuid:project_id>/files/",
        FileListCreateView.as_view(),
        name="file-list",
    ),
    path(
        "<uuid:project_id>/files/<uuid:pk>/",
        FileDeleteView.as_view(),
        name="file-delete",
    ),
]