"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface EvidencePreviewProps {
  evidenceId: string;
  title: string;
}

interface EvidenceUrls {
  originalUrl: string;
  stampedUrl: string;
}

export function EvidencePreview({ evidenceId, title }: EvidencePreviewProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [previewState, setPreviewState] = useState<{
    evidenceId: string;
    retryCount: number;
    urls: EvidenceUrls | null;
    errorMessage: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/evidence/${evidenceId}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as EvidenceUrls & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Evidence is unavailable.");
        if (active) setPreviewState({ evidenceId, retryCount, urls: result, errorMessage: null });
      })
      .catch((error: unknown) => {
        console.error("Could not retrieve private evidence URLs.", error);
        if (active) {
          setPreviewState({
            evidenceId,
            retryCount,
            urls: null,
            errorMessage: error instanceof Error ? error.message : "Evidence is unavailable.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [evidenceId, retryCount]);

  const currentPreview = previewState?.evidenceId === evidenceId && previewState.retryCount === retryCount
    ? previewState
    : null;

  if (currentPreview?.errorMessage) {
    return (
      <div className="mt-3">
        <p className="text-sm text-red-800" role="alert">{currentPreview.errorMessage}</p>
        <button
          className="button-secondary mt-3"
          onClick={() => setRetryCount((count) => count + 1)}
          type="button"
        >
          Retry evidence
        </button>
      </div>
    );
  }
  if (!currentPreview?.urls) {
    return <p className="muted mt-3 text-sm">Loading private evidence…</p>;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <figure className="rounded-xl border border-[#dce5e1] p-3">
        <Image
          alt={`${title}, stamped derivative with submission time and coordinates`}
          className="h-auto max-h-80 w-full rounded-lg object-contain"
          height={600}
          src={currentPreview.urls.stampedUrl}
          unoptimized
          width={800}
        />
        <figcaption className="mt-2 text-sm font-semibold">Stamped derivative</figcaption>
        <a className="mt-1 inline-block text-xs font-semibold underline" href={currentPreview.urls.stampedUrl} rel="noreferrer" target="_blank">
          Open stamped image
        </a>
      </figure>
      <div className="rounded-xl border border-[#dce5e1] p-3">
        <p className="font-semibold">Original image</p>
        <p className="muted mt-2 text-sm leading-6">
          Preserved separately from the visible-stamp derivative. Signed access expires after one minute.
        </p>
        <a className="mt-3 inline-block text-sm font-semibold underline" href={currentPreview.urls.originalUrl} rel="noreferrer" target="_blank">
          Open original image
        </a>
      </div>
    </div>
  );
}
