export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-3 text-sm text-zinc-600">We respect your privacy. Uploaded files are processed securely and never shared publicly. We store minimal data necessary to operate your account, billing, and history. You may request deletion at any time.</p>
      <ul className="mt-4 list-disc pl-5 text-sm text-zinc-600 space-y-1">
        <li>Files: stored privately and deleted on request.</li>
        <li>JSON results: kept for your history and export.</li>
        <li>Billing: Stripe test mode; see Stripe’s own policy.</li>
      </ul>
      <p className="mt-4 text-sm text-zinc-600">For questions, contact support.</p>
    </main>
  );
}
