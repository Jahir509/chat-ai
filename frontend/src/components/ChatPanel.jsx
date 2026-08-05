import { useEffect, useRef, useState } from "react";
import api, { apiError, listOf } from "../api/client";
import { Button, ErrorBox, Spinner } from "../ui";

export default function ChatPanel({ projectId }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [booting, setBooting] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const initedFor = useRef(null);

  // Load conversations; create one if the project has none, so `send`
  // never has to create a conversation mid-flight.
  useEffect(() => {
    if (initedFor.current === projectId) return; // guard double-invoke
    initedFor.current = projectId;

    (async () => {
      setBooting(true);
      try {
        const { data } = await api.get(`/projects/${projectId}/conversations/`);
        let list = listOf(data);
        if (list.length === 0) {
          const created = await api.post(`/projects/${projectId}/conversations/`, {});
          list = [created.data];
        }
        setConversations(list);
        setActiveId(list[0].id);
      } catch (err) {
        setError(apiError(err));
      } finally {
        setBooting(false);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingMsgs(true);
    api
      .get(`/conversations/${activeId}/messages/`)
      .then(({ data }) => setMessages(listOf(data)))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoadingMsgs(false));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function newChat() {
    try {
      const { data } = await api.post(`/projects/${projectId}/conversations/`, {});
      setConversations((prev) => [data, ...prev]);
      setMessages([]);
      setActiveId(data.id);
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending || !activeId) return;

    setError("");
    setText("");
    setSending(true);

    const temp = { id: `temp-${Date.now()}`, role: "user", content };
    setMessages((prev) => [...prev, temp]);

    try {
      const { data } = await api.post(`/conversations/${activeId}/messages/`, {
        content,
      });
      // Swap the optimistic bubble for the two persisted rows.
      setMessages((prev) => [...prev.filter((m) => m.id !== temp.id), ...data]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId && !c.title ? { ...c, title: content.slice(0, 60) } : c
        )
      );
    } catch (err) {
      setError(
        apiError(err, "The agent could not reply. Your message was saved — try again.")
      );
    } finally {
      setSending(false);
    }
  }

  if (booting)
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );

  return (
    <div className="flex h-[32rem] gap-4">
      <aside className="hidden w-52 shrink-0 flex-col rounded-xl border border-slate-200 bg-white sm:flex">
        <div className="border-b border-slate-200 p-3">
          <Button onClick={newChat} className="w-full">
            New chat
          </Button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition
                  ${
                    c.id === activeId
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {c.title || "New conversation"}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loadingMsgs ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : messages.length === 0 ? (
            <p className="pt-10 text-center text-sm text-slate-400">
              Send a message to start.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm
                    ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="border-t border-slate-200 p-3">
          <ErrorBox>{error}</ErrorBox>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask something…"
              disabled={sending}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50"
            />
            <Button type="submit" disabled={sending || !text.trim()}>
              Send
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}