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
  const [urls, setUrls] = useState<EvidenceUrls | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/evidence/${evidenceId}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as EvidenceUrls & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Evidence is unavailable.");
        if (active) setUrls(result);
      })
      .catch((error: unknown) => {
        console.error("Could not retrieve private evidence URLs.", error);
        if (active) setErrorMessage(error instanceof Error ? error.message : "Evidence is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [evidenceId]);

  if (errorMessage) {
    return <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>;
  }
  if (!urls) {
    return <p className="muted mt-3 text-sm">Loading private evidence…</p>;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <figure className="rounded-xl border border-[#dce5e1] p-3">
        <Image
          alt={`${title}, stamped derivative with submission time and coordinates`}
          className="h-auto max-h-80 w-full rounded-lg object-contain"
          height={600}
          src={urls.stampedUrl}
          unoptimized
          width={800}
        />
        <figcaption className="mt-2 text-sm font-semibold">Stamped derivative</figcaption>
        <a className="mt-1 inline-block text-xs font-semibold underline" href={urls.stampedUrl} rel="noreferrer" target="_blank">
          Open stamped image
        </a>
      </figure>
      <div className="rounded-xl border border-[#dce5e1] p-3">
        <p className="font-semibold">Original image</p>
        <p className="muted mt-2 text-sm leading-6">
          Preserved separately from the visible-stamp derivative. Signed access expires after one minute.
        </p>
        <a className="mt-3 inline-block text-sm font-semibold underline" href={urls.originalUrl} rel="noreferrer" target="_blank">
          Open original image
        </a>
      </div>
    </div>
  );
}
