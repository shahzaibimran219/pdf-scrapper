import { Uploader } from "@/components/ui/uploader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UploadPage() {
  const session = await getServerSession();
  const user = session?.user?.id
    ? await prisma.user.findUnique({ 
        where: { id: session.user.id }, 
        select: { planType: true, credits: true } 
      })
    : null;

  const isLowCredits = (user?.credits ?? 0) < 100;
  const needsRenewal = (user?.credits ?? 0) < 100 && user?.planType !== "FREE";

  return (
    <div className="space-y-6">
      {needsRenewal && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">⚠️ Subscription Renewal Required</h3>
          <p className="text-sm text-red-700">
            You have {user?.credits ?? 0} credits remaining. You need at least 100 credits to scrape PDFs. 
            Please renew your subscription to continue using the service.
          </p>
        </div>
      )}

      {isLowCredits && !needsRenewal && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-medium text-yellow-800">⚠️ Low Credits Warning</h3>
          <p className="text-sm text-yellow-700">
            You have {user?.credits ?? 0} credits remaining. Consider upgrading your plan for more credits.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-1">
        <CardHeader>
          <h2 className="text-md font-medium">Upload a resume to scrape</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">PDF only, up to 10 MB</p>
        </CardHeader>
        <CardContent>
          <Uploader />
        </CardContent>
      </Card>

      <Card className="md:col-span-1">
        <CardHeader>
          <h3 className="text-lg font-medium">Tips</h3>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Make the most of your extraction.</p>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
            <li>Prefer digital PDFs over scanned images for best accuracy.</li>
            <li>Keep file size under 10 MB; remove unnecessary images if needed.</li>
            <li>We snapshot each successful run so you can review history later.</li>
            <li>Private by default — files are stored under your account in a secure bucket.</li>
          </ul>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}


