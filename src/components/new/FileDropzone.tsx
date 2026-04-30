"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

const ACCEPTED = [".pptx", ".pdf", ".docx"];
const ACCEPT_ATTR = ACCEPTED.join(",");

interface Props {
  file: File | null;
  onChange: (f: File | null) => void;
}

export function FileDropzone({ file, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fl: FileList | null) {
    setError(null);
    if (!fl || fl.length === 0) return;
    const f = fl[0];
    const lower = f.name.toLowerCase();
    if (!ACCEPTED.some((ext) => lower.endsWith(ext))) {
      setError(`Unsupported file. Accepts ${ACCEPTED.join(", ")}.`);
      return;
    }
    onChange(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!hover) setHover(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setHover(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setHover(false);
    handleFiles(e.dataTransfer.files);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[rgb(var(--primary)/0.4)] bg-[rgb(var(--primary)/0.06)]">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[rgb(var(--primary)/0.15)] shrink-0">
          <FileText className="w-5 h-5 text-[rgb(var(--primary))]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate">{file.name}</p>
          <p className="text-[11px] text-foreground/55 tabular-nums">{fmtSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-8 h-8 rounded-md flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-[rgb(var(--fg)/0.05)]"
          title="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        className={
          "relative flex flex-col items-center justify-center gap-2 px-6 py-12 rounded-xl border-2 border-dashed transition-smooth cursor-pointer focus:outline-none " +
          (hover
            ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.08)]"
            : "border-border hover:border-[rgb(var(--primary)/0.5)] hover:bg-[rgb(var(--primary)/0.04)]")
        }
      >
        <div
          className={
            "w-12 h-12 rounded-full flex items-center justify-center transition-smooth " +
            (hover ? "bg-[rgb(var(--primary))] text-white" : "bg-[rgb(var(--primary)/0.12)] text-[rgb(var(--primary))]")
          }
        >
          <Upload className="w-5 h-5" strokeWidth={2} />
        </div>
        <p className="text-[13px] font-medium mt-1">
          {hover ? "Drop to upload" : "Drag & drop a file here"}
        </p>
        <p className="text-[11px] text-foreground/50">
          or <span className="text-[rgb(var(--primary))] font-medium underline-offset-2 hover:underline">browse</span>
          {" — "}PPTX, PDF, DOCX (up to 200 MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-[rgb(var(--error))]">{error}</p>
      )}
    </>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
