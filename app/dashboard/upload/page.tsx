import { Uploader } from "@/components/ui/uploader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function UploadPage() {
  return (
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
  );
}


