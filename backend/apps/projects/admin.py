from django.contrib import admin

from .models import Project, Prompt


class PromptInline(admin.TabularInline):
    model = Prompt
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "model", "created_at")
    list_filter = ("model",)
    search_fields = ("name", "owner__email")
    inlines = [PromptInline]