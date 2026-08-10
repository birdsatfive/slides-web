/**
 * What was uploaded. Stored on the version as `generation_meta.kind`; older
 * rows only have the storage key, so the extension is the fallback.
 */
export type FileKind = "html" | "pdf" | "folder";

export function fileKindFrom(
  meta: Record<string, unknown> | null | undefined,
  htmlPath: string | null,
): FileKind {
  const kind = meta?.kind;
  if (kind === "html_bundle") return "folder";
  if (kind === "pdf") return "pdf";
  if (kind === "html_file" || kind === "html_raw") return "html";
  return htmlPath?.toLowerCase().endsWith(".pdf") ? "pdf" : "html";
}

export function fileKindLabel(kind: FileKind): string {
  if (kind === "pdf") return "PDF";
  if (kind === "folder") return "Folder";
  return "HTML";
}
