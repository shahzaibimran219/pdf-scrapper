import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - PDF Resume Scrapper",
  description: "Terms of service for PDF Resume Scrapper. Read our acceptable use and billing terms.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-3 text-sm text-zinc-600">By using this service, you agree to our acceptable use and billing terms. Do not upload content you do not have rights to. We provide the service as‑is in test mode and may change features at any time.</p>
      <ul className="mt-4 list-disc pl-5 text-sm text-zinc-600 space-y-1">
        <li>Acceptable use only; no illegal content.</li>
        <li>Billing via Stripe test mode; subscriptions grant credits.</li>
        <li>We may suspend accounts for abuse.</li>
      </ul>
      <p className="mt-4 text-sm text-zinc-600">Contact support for any questions.</p>
    </main>
  );
}
