"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImageForUpload } from "@/lib/image-compression";
import { useAgentContext } from "@/components/agent/agent-provider";
import {
  DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  documentStoragePath,
  type DocumentColumn,
  type DocumentSlug,
} from "@/lib/documents";

export type DocumentSlotData = {
  column: DocumentColumn;
  slug: DocumentSlug;
  label: string;
  path: string | null;
  signedUrl: string | null;
};

export function CustomerDocuments({
  customerId,
  initialDocuments,
}: {
  customerId: string;
  initialDocuments: DocumentSlotData[];
}) {
  const { activeAgent } = useAgentContext();
  const [documents, setDocuments] = useState(initialDocuments);
  const [busySlug, setBusySlug] = useState<DocumentSlug | null>(null);
  const [errorBySlug, setErrorBySlug] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function setError(slug: DocumentSlug, message: string | null) {
    setErrorBySlug((prev) => {
      const next = { ...prev };
      if (message) next[slug] = message;
      else delete next[slug];
      return next;
    });
  }

  async function handleFileSelected(doc: DocumentSlotData, file: File) {
    setBusySlug(doc.slug);
    setError(doc.slug, null);

    try {
      const looksLikeImage = file.type.startsWith("image/") || /\.hei[cf]$/i.test(file.name);
      if (!looksLikeImage) {
        throw new Error("Please choose an image file.");
      }

      const compressed = await compressImageForUpload(file);
      const path = documentStoragePath(customerId, doc.slug);
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("customers")
        .update({ [doc.column]: path })
        .eq("id", customerId)
        .eq("agent", activeAgent);
      if (updateError) throw new Error(updateError.message);

      const { data: signedData, error: signedError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signedError) throw new Error(signedError.message);

      setDocuments((prev) =>
        prev.map((d) =>
          d.slug === doc.slug ? { ...d, path, signedUrl: signedData?.signedUrl ?? null } : d,
        ),
      );
    } catch (err) {
      setError(doc.slug, err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusySlug(null);
    }
  }

  async function handleRemove(doc: DocumentSlotData) {
    if (!doc.path) return;
    if (!window.confirm(`Remove ${doc.label}? This cannot be undone.`)) return;

    setBusySlug(doc.slug);
    setError(doc.slug, null);

    try {
      const supabase = createClient();

      const { error: removeError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([doc.path]);
      if (removeError) throw new Error(removeError.message);

      const { error: updateError } = await supabase
        .from("customers")
        .update({ [doc.column]: null })
        .eq("id", customerId)
        .eq("agent", activeAgent);
      if (updateError) throw new Error(updateError.message);

      setDocuments((prev) =>
        prev.map((d) => (d.slug === doc.slug ? { ...d, path: null, signedUrl: null } : d)),
      );
    } catch (err) {
      setError(doc.slug, err instanceof Error ? err.message : "Could not remove document.");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {documents.map((doc) => {
          const isBusy = busySlug === doc.slug;
          const error = errorBySlug[doc.slug];

          return (
            <div key={doc.slug} className="flex flex-col gap-1.5">
              <div
                className={
                  doc.signedUrl
                    ? "group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    : "relative aspect-square overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-slate-400 hover:bg-slate-100"
                }
              >
                {doc.signedUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLightbox({ label: doc.label, url: doc.signedUrl! })}
                      className="block h-full w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doc.signedUrl}
                        alt={doc.label}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-slate-900/70 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => fileInputs.current[doc.slug]?.click()}
                        disabled={isBusy}
                        className="text-xs font-medium text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(doc)}
                        disabled={isBusy}
                        className="text-xs font-medium text-red-300 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                    {isBusy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs font-medium text-slate-600">
                        Uploading...
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputs.current[doc.slug]?.click()}
                    disabled={isBusy}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-xs font-medium text-slate-400">
                      {isBusy ? "Uploading..." : "Tap to upload"}
                    </span>
                    <span className="text-xs text-slate-500">{doc.label}</span>
                  </button>
                )}
              </div>

              {doc.signedUrl && (
                <span className="text-center text-xs text-slate-500">{doc.label}</span>
              )}

              {error && <p className="text-center text-xs text-red-600">{error}</p>}

              <input
                ref={(el) => {
                  fileInputs.current[doc.slug] = el;
                }}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFileSelected(doc, file);
                }}
              />
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-4 text-white">
              <span className="text-sm font-medium">{lightbox.label}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-md px-2 py-1 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
