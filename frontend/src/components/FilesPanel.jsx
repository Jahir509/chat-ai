import { useEffect, useRef, useState } from "react";
import api, { apiError } from "../api/client";
import { Button, Card, ErrorBox, Spinner } from "../ui";

const LABELS = {
  completed: ["Ready", "text-emerald-600"],
  in_progress: ["Indexing…", "text-amber-600"],
  failed: ["Failed", "text-red-600"],
  cancelled: ["Cancelled", "text-slate-400"],
};

const kb = (n) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default function FilesPanel({ projectId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const load = () =>
    api
      .get(`/projects/${projectId}/files/`)
      .then(({ data }) => setFiles(data))
      .catch((err) => setError(apiError(err)));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [projectId]);

  // Poll only while something is still indexing.
  useEffect(() => {
    if (!files.some((f) => f.status === "in_progress")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [files]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post(`/projects/${projectId}/files/`, body);
      setFiles((prev) => [data, ...prev]);
    } catch (err) {
      setError(apiError(err, "Upload failed."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id) {
    const previous = files;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    try {
      await api.delete(`/projects/${projectId}/files/${id}/`);
    } catch (err) {
      setFiles(previous);
      setError(apiError(err));
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBox>{error}</ErrorBox>

      <Card>
        <h3 className="mb-1 font-medium text-slate-900">Upload a file</h3>
        <p className="mb-3 text-sm text-slate-500">
          The agent can search uploaded documents when answering. PDF, DOCX, TXT, MD,
          CSV — up to 20 MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          onChange={onPick}
          disabled={uploading}
          className="block w-full text-sm text-slate-600
            file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2
            file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700
            disabled:opacity-50"
        />
        {uploading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="h-4 w-4" /> Uploading…
          </p>
        )}
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No files yet.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const [label, color] = LABELS[f.status] ?? [f.status, "text-slate-500"];
            return (
              <li key={f.id}>
                <Card className="flex items-center justify-between gap-3 !p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {f.filename}
                    </p>
                    <p className="text-xs text-slate-400">
                      {kb(f.size)} · <span className={color}>{label}</span>
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => remove(f.id)}>
                    Delete
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}