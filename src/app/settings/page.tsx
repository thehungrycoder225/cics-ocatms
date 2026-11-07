import Link from "next/link";
import { PwaInstallHelp } from "@/components/pwa-install-help";

export default function SettingsPage() {
  return (
    <main className="page-shell">
      <article className="content-width card p-6 sm:p-9">
        <Link className="brand text-lg no-underline" href="/">
          <span aria-hidden="true" className="brand-mark">OC</span>
          <span>MarSU OCATMS</span>
        </Link>
        <h1 className="mt-8 text-2xl font-bold">Privacy and installation</h1>
        <div className="muted mt-4 max-w-3xl space-y-4 leading-7">
          <p>
            OCATMS requests location only when a participant starts travel, updates a location,
            submits arrival, or checks out. These are participant-initiated actions; OCATMS does
            not continuously track a device or claim to know its live location while the app is
            closed.
          </p>
          <p>
            Submitted milestones include the reported coordinates, GPS accuracy and acquisition
            time, server receipt time, and related itinerary information. Arrival and check-out
            photos are stored as private evidence with an original and a stamped derivative.
            Authorized Deans may review records within their college scope; VPSAS has university-wide
            oversight access. A visible stamp is not independent proof of presence or photo
            authenticity.
          </p>
          <p>
            Camera and location access are requested only after you choose a travel action that
            needs them. Permission denial or an offline connection prevents submission; OCATMS does
            not queue evidence for later upload. Retry only after checking the action status to avoid
            duplicate work.
          </p>
          <p>
            When route estimates are enabled, starting travel or updating a location sends the
            reported origin and itinerary destination coordinates to Mapbox Directions. Estimates
            are not live tracking. Two-wheeler route estimates are unavailable.
          </p>
          <p>
            This page describes current application behavior; it is not the University&apos;s approved
            privacy notice. Institutional approval of the legal basis, participant notice, retention
            schedule, and privacy impact assessment is required before a live pilot. Contact the
            University&apos;s designated privacy office for questions about those policies.
          </p>
          <p>
            The service worker uses network-only requests and does not cache private evidence,
            authenticated APIs, or offline submissions.
          </p>
        </div>
        <PwaInstallHelp />
        <Link className="mt-7 inline-block font-semibold text-[#245b4e] underline" href="/">
          Back to OCATMS
        </Link>
      </article>
    </main>
  );
}
