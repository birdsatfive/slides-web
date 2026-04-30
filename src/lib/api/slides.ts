import "server-only";
import { signSlidesApiToken } from "./jwt";
import { createClient } from "@/lib/supabase/server";

const BASE = process.env.SLIDES_API_URL || "http://localhost:8000";

/** Resolve { sub, org_id, email } from the current Supabase session. */
async function currentPrincipal() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  // Org is carried in user.app_metadata.org_id when seeded by ops; falls back
  // to email-domain → birdsatfive bucket if missing (single-tenant for now).
  const orgId =
    (user.app_metadata as Record<string, unknown> | undefined)?.org_id as string | undefined ??
    "birdsatfive";
  return { sub: user.id, org_id: orgId, email: user.email ?? undefined };
}

export type SourceKind = "pptx" | "pdf" | "docx" | "url" | "markdown" | "sharepoint" | "prompt";

export interface NormalizedSlide {
  title: string;
  bullets: string[];
  notes: string;
  images: string[];
  raw?: unknown;
}
export interface Extraction {
  slides: NormalizedSlide[];
  theme_hints: { colors: string[]; fonts: string[] };
  source: { kind: SourceKind; ref: string };
  total_slides: number;
  prompt?: string;
}

export interface SlideBlock { id: string; kind: string; content: unknown }
export interface OutlineSlide { id: string; type: string; blocks: SlideBlock[] }

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: HeadersInit } = {},
): Promise<T> {
  const principal = await currentPrincipal();
  const token = signSlidesApiToken(principal);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body;
  } else if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }

  const r = await fetch(`${BASE}${path}`, { method: init.method, headers, body, cache: "no-store" });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`slides-api ${path} [${r.status}]: ${text}`);
  }
  return (await r.json()) as T;
}

/** Multi-source extract. JSON body for url/markdown/sharepoint/prompt; multipart for files. */
export const slidesApi = {
  extractText: (kind: Exclude<SourceKind, "pptx" | "pdf" | "docx">, payload: string) =>
    call<Extraction>("/v1/extract", { method: "POST", body: { kind, payload } }),

  extractFile: async (file: File): Promise<Extraction> => {
    const fd = new FormData();
    fd.set("file", file);
    return call<Extraction>("/v1/extract", { method: "POST", body: fd });
  },

  outline: (extraction: Extraction, goal = "", tagging?: { deck_id?: string; version_id?: string }) =>
    call<{ slide_tree: OutlineSlide[] }>("/v1/generate/outline", {
      method: "POST",
      body: { extraction, goal, ...tagging },
    }),

  renderDeck: (args: {
    deck_id: string; version_id: string; title: string;
    slide_tree: OutlineSlide[];
    design_spec?: Record<string, unknown>;
    screenshot_urls?: string[];
  }) =>
    call<{ html_path: string; bytes: number }>("/v1/generate/deck", {
      method: "POST",
      body: args,
    }),

  remixSlide: (args: {
    slide: OutlineSlide; remix_prompt: string;
    design_spec?: Record<string, unknown>;
    deck_id?: string; version_id?: string;
  }) =>
    call<{ fragment: string }>("/v1/generate/slide", { method: "POST", body: args }),

  exportPdf: (args: { deck_id: string; version_id: string; html: string }) =>
    call<{ path: string; bytes: number }>("/v1/export/pdf", { method: "POST", body: args }),
};
