import { useEffect, useRef, useState } from "react";
import api, { apiError } from "../api/client";
import { Button, Card, ErrorBox, Spinner } from "../ui";

const LABELS = {
  completed: ["Ready", "text-emerald-600"],
  in_progress: ["Indexing…", "text-amber-600"],
  failed: ["Failed", "text-red-600"],
  cancelled: ["Cancelled", "text-slate-400"],
};

const POLL_MS = 3000;
const SLOW_POLL_MS = 10000; // every list call costs the backend an OpenAI round-trip
const FAST_FOR_MS = 30000; // most files index in seconds; ease off after that
const MAX_WAIT_MS = 5 * 60 * 1000; // matches STALE_AFTER on the server
const MAX_FAILURES = 3; // a blip mid-indexing shouldn't end the watch

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function FilesPanel({ projectId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [stalled, setStalled] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const runRef = useRef(0);
  const pollFailedRef = useRef(false);

  // Single fetch. Returns {data} or {err} rather than touching state, so the
  // caller decides what to surface — that's what keeps polling out of render.
  async function fetchFiles() {
    try {
      const { data } = await api.get(`/projects/${projectId}/files/`);
      return { data };
    } catch (err) {
      return { err };
    }
  }

  // Clears the pending tick *and* invalidates any chain currently awaiting a
  // response. Without the counter bump, an in-flight fetch would resolve later
  // and schedule a tick we can no longer cancel — one orphan chain per overlap.
  function stopPolling() {
    runRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Recursive setTimeout, not setInterval: each tick is scheduled only if the
  // previous response still showed something indexing.
  async function pollChain(run, startedAt, failures) {
    const { data, err } = await fetchFiles();
    if (run !== runRef.current) return; // superseded or unmounted while awaiting

    if (err) {
      if (failures + 1 >= MAX_FAILURES) {
        pollFailedRef.current = true;
        setError(apiError(err));
        setStalled(true);
        return;
      }
      timerRef.current = setTimeout(
        () => pollChain(run, startedAt, failures + 1),
        POLL_MS * 2 ** failures,
      );
      return;
    }

    setFiles(data);
    if (pollFailedRef.current) {
      pollFailedRef.current = false;
      setError(""); // recovered — but never clobber an upload/delete message
    }
    if (!data.some((f) => f.status === "in_progress")) return;

    const elapsed = Date.now() - startedAt;
    if (elapsed >= MAX_WAIT_MS) {
      setStalled(true);
      return;
    }
    timerRef.current = setTimeout(
      () => pollChain(run, startedAt, 0),
      elapsed < FAST_FOR_MS ? POLL_MS : SLOW_POLL_MS,
    );
  }

  // Supersedes whatever chain was running, so there is never more than one.
  function startPolling(delay = 0) {
    stopPolling();
    const run = runRef.current;
    const startedAt = Date.now();
    if (delay) {
      timerRef.current = setTimeout(() => pollChain(run, startedAt, 0), delay);
    } else {
      pollChain(run, startedAt, 0);
    }
  }

  // Mounted per project (ProjectDetail keys us on the id), so there's no stale
  // state to reset here — a different project gets a fresh panel.
  useEffect(() => {
    stopPolling();
    const run = runRef.current;
    (async () => {
      const { data, err } = await fetchFiles();
      if (run !== runRef.current) return;
      setLoading(false);
      if (err) {
        setError(apiError(err));
        return;
      }
      setFiles(data);
      if (data.some((f) => f.status === "in_progress")) startPolling(POLL_MS);
    })();

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) {
      setError("That file is empty.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const { data } = await api.post(`/projects/${projectId}/files/`, body);
      setFiles((prev) => [data, ...prev]);
      setStalled(false);
      if (data.status === "in_progress") startPolling(POLL_MS);
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

  function refresh() {
    setStalled(false);
    startPolling();
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

      {stalled && (
        <Card className="!border-amber-200 !bg-amber-50 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            Stopped checking for status updates. The file may still be processing.
          </p>
          <Button variant="ghost" onClick={refresh}>
            Check again
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">No files yet.</p>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={refresh}>
              Refresh
            </Button>
          </div>
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
                        {fmtSize(f.size)} · <span className={color}>{label}</span>
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
        </>
      )}
    </div>
  );
}