import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiError, listOf } from "../api/client";
import { Button, Card, ErrorBox, Input, Spinner } from "../ui";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    api
      .get("/projects/")
      .then(({ data }) => setProjects(listOf(data)))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post("/projects/", form);
      setProjects((prev) => [data, ...prev]);
      setForm({ name: "", description: "" });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this project and all its conversations?")) return;
    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id)); // optimistic
    try {
      await api.delete(`/projects/${id}/`);
    } catch (err) {
      setProjects(previous); // roll back
      setError(apiError(err));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">New project</h2>
        <ErrorBox>{error}</ErrorBox>
        <form onSubmit={onCreate} className="space-y-4">
          <Input
            label="Name"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Support Bot"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Answers product questions"
          />
          <Button type="submit" disabled={creating}>
            {creating && <Spinner className="h-4 w-4" />}
            Create project
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Your projects</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-7 w-7" />
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              No projects yet. Create one above to start chatting.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Card className="flex h-full flex-col justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      {p.model} · {p.prompt_count} prompt
                      {p.prompt_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link to={`/projects/${p.id}`} className="flex-1">
                      <Button className="w-full">Open</Button>
                    </Link>
                    <Button variant="danger" onClick={() => onDelete(p.id)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}