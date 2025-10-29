import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BillingActions from "@/components/settings/BillingActions";

export default async function SettingsPage() {
  const session = await getServerSession();
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { planType: true, credits: true } })
    : null;
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-2">Subscription</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage your plan and credits. Test mode only.</p>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Current plan</span>
              <span className="font-medium">{user?.planType ?? "FREE"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Credits</span>
              <span className="font-medium">{user?.credits ?? 0}</span>
            </div>
          </div>
          <div className="mt-4">
            <BillingActions />
          </div>
        </div>
      </div>
    </div>
  );
}


