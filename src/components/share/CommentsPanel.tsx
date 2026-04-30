"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

interface Comment {
  id: string;
  slide_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

interface Props {
  shareLinkId: string;
  /** When set, the panel filters to this slide and tags new comments with it. */
  activeSlideId: string | null;
  /** Stable session id (matches share_views.session_id) so we can join later. */
  sessionId: string;
}

const STORAGE_AUTHOR_KEY = "slides:author";

export function CommentsPanel({ shareLinkId, activeSlideId, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Persist author name across sessions (matches prototype's localStorage author).
  useEffect(() => {
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_AUTHOR_KEY) : null;
    if (cached) setAuthor(cached);
  }, []);

  useEffect(() => {
    if (!open) return;
    const url = new URL("/api/share/comments", window.location.origin);
    url.searchParams.set("share_link_id", shareLinkId);
    if (activeSlideId) url.searchParams.set("slide_id", activeSlideId);
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => {});
  }, [open, shareLinkId, activeSlideId]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments, open]);

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const trimmedAuthor = author.trim();
      if (trimmedAuthor) localStorage.setItem(STORAGE_AUTHOR_KEY, trimmedAuthor);
      const r = await fetch("/api/share/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_link_id: shareLinkId,
          slide_id: activeSlideId,
          session_id: sessionId,
          author_name: trimmedAuthor,
          body: body.trim(),
        }),
      });
      const d = await r.json();
      if (d.comment) {
        setComments((c) => [...c, d.comment]);
        setBody("");
      }
    } finally {
      setPosting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[rgb(var(--primary))] text-white text-[12px] font-medium shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
        title="Open comments"
      >
        <MessageSquare className="w-4 h-4" />
        {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comments"}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] panel-card overflow-hidden flex flex-col max-h-[70vh]">
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card">
        <p className="text-[12px] font-medium inline-flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          {activeSlideId ? "Slide comments" : "Deck comments"}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="icon-btn" title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-[12px]">
        {comments.length === 0 ? (
          <p className="text-foreground/45 text-center pt-6">
            No comments yet. Leave the first thought.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{c.author_name}</span>
                <span className="text-[10px] text-foreground/40">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-foreground/85 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2 bg-card/60">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-[12px] outline-none focus:border-[rgb(var(--primary))]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={activeSlideId ? "Comment on this slide…" : "Comment…"}
          rows={2}
          className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-[12px] outline-none focus:border-[rgb(var(--primary))]"
        />
        <button
          type="button"
          onClick={post}
          disabled={posting || !body.trim()}
          className="w-full px-3 py-1.5 rounded-md bg-[rgb(var(--primary))] text-white text-[12px] font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Send className="w-3.5 h-3.5" />
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
