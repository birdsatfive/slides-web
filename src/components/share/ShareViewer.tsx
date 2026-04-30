"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  htmlUrl: string;
  shareLinkId: string;
}

/**
 * Public deck viewer. Streams the rendered HTML inside a sandboxed iframe and
 * heart-beats `/api/share/track` every 15s so we know who watched what.
 */
export function ShareViewer({ title, htmlUrl, shareLinkId }: Props) {
  const sessionRef = useRef<string>("");

  useEffect(() => {
    if (!sessionRef.current) {
      sessionRef.current = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    }
    const sessionId = sessionRef.current;
    let active = true;
    let elapsed = 0;
    let lastSlide: number | null = null;

    function send(payload: Record<string, unknown>) {
      const body = JSON.stringify({ share_link_id: shareLinkId, session_id: sessionId, ...payload });
      try {
        navigator.sendBeacon?.("/api/share/track", new Blob([body], { type: "application/json" }))
          ?? fetch("/api/share/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
      } catch {/* swallow */}
    }

    send({ event: "open", referer: document.referrer || null, ua: navigator.userAgent });

    const interval = setInterval(() => {
      if (!active || document.hidden) return;
      elapsed += 15;
      send({ event: "heartbeat", active_seconds: elapsed, slide: lastSlide });
    }, 15000);

    function onMessage(ev: MessageEvent) {
      // Generated decks dispatch slide-change events on hashchange — listen if iframe posts them.
      if (ev.data && typeof ev.data === "object" && ev.data.type === "slide-change") {
        lastSlide = Number(ev.data.slide);
        send({ event: "slide", slide: lastSlide });
      }
    }
    window.addEventListener("message", onMessage);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("message", onMessage);
      send({ event: "close", active_seconds: elapsed });
    };
  }, [shareLinkId]);

  return (
    <div className="fixed inset-0">
      <iframe
        src={htmlUrl}
        title={title}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
