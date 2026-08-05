import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { apiError } from "../api/client";
import ChatPanel from "../components/ChatPanel";
import PromptsPanel from "../components/PromptsPanel";
import { ErrorBox, Spinner } from "../ui";
import FilesPanel from "../components/FilesPanel";

const TABS = [
  ["chat", "Chat"],
  ["prompts", "Prompts"],
  ["files", "Files"],
];

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("chat");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/projects/${id}/`)
      .then(({ data }) => setProject(data))
      .catch((err) => setError(apiError(err, "Project not found.")));
  }, [id]);

  if (error)
    return (
      <div className="space-y-3">
        <ErrorBox>{error}</ErrorBox>
        <Link to="/projects" className="text-sm text-indigo-600 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );

  if (!project)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7" />
      </div>
    );

  return (
    <div className="space-y-5">
      <div>
        <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-700">
          ← Projects
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{project.name}</h1>
        <p className="text-sm text-slate-500">
          {project.description || "No description"} · {project.model}
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition
              ${
                tab === key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <ChatPanel projectId={id} />}
      {tab === "prompts" && <PromptsPanel projectId={id} />}
      {tab === "files" && <FilesPanel key={id} projectId={id} />}
    </div>
  );
}