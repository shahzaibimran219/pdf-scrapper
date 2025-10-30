import ResumeUploader from "@/components/ResumeUploader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-1">
          <CardHeader>
            <h2 className="text-md font-medium">Upload your resume (PDF)</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Works for both text-based and scanned/image PDFs.</p>
          </CardHeader>
          <CardContent>
            <ResumeUploader />
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
              <li>Private by default — files are processed with short‑lived links and stored securely.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


