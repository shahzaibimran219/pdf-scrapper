import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExportCopyButtons } from "@/components/resumes/ExportCopyButtons";
import { ArrowLeft, FileX, AlertTriangle } from "lucide-react";
import { CollapsibleJson } from "@/components/json/CollapsibleJson";
import { calculateMissingDataPercentage } from "@/lib/resume-utils";

type Props = { params: Promise<{ id: string }> };

export default async function ResumeDetailPage({ params }: Props) {
  const { id } = await params;
  const resume = await prisma.resume.findUnique({ where: { id } });
  if (!resume) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-lg rounded-2xl border bg-[hsl(var(--card))] p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <FileX className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Resume not found</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">It may have been removed or the link is incorrect.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/dashboard/history" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-[hsl(var(--muted))]">
              <ArrowLeft className="h-4 w-4" /> Back to history
            </Link>
            <Link href="/dashboard/upload" className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] hover:opacity-90">
              Upload new
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const data: any = resume.resumeData ?? {};
  const profile: any = data?.profile ?? {};
  const workExperiences: any[] = Array.isArray(data?.workExperiences) ? data.workExperiences : [];
  const educations: any[] = Array.isArray(data?.educations) ? data.educations : [];
  const skills: string[] = Array.isArray(data?.skills) ? data.skills : [];
  const licenses: any[] = Array.isArray(data?.licenses) ? data.licenses : [];
  const languages: any[] = Array.isArray(data?.languages) ? data.languages : [];
  const achievements: any[] = Array.isArray(data?.achievements) ? data.achievements : [];
  const publications: any[] = Array.isArray(data?.publications) ? data.publications : [];
  const honors: any[] = Array.isArray(data?.honors) ? data.honors : [];

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/history" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          {resume.storagePath ? (
            <form action={`/api/extract`} method="post">
              <input type="hidden" name="storagePath" value={resume.storagePath} />
              <input type="hidden" name="sourceHash" value={resume.sourceHash} />
              <Button type="submit" variant="secondary" size="sm">Re-run extraction</Button>
            </form>
          ) : null}
          <a href="#raw-json" className="rounded-md font-medium border px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]">Raw JSON</a>
          <ExportCopyButtons
            jsonText={JSON.stringify(resume.resumeData ?? {}, null, 2)}
            downloadName={`${resume.fileName.replace(/\.pdf$/i, "")}-resume.json`}
          />
        </div>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mt-4">{profile?.name ? `${profile.name}${profile?.surname ? ` ${profile.surname}` : ""}` : resume.fileName}</h1>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Uploaded {new Date(resume.uploadedAt).toLocaleString()}</p>

      {(() => {
        const missingPercentage = calculateMissingDataPercentage(resume.resumeData);
        if (missingPercentage > 60) {
          return (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-800">Didn't find much data, are you sure you uploaded a resume?</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    We were only able to extract {100 - missingPercentage}% of the expected resume information. 
                    This might happen if the PDF contains mostly images, scanned documents with poor quality, or isn't actually a resume.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {resume.storagePath ? (
                      <form action={`/api/extract`} method="post" className="inline">
                        <input type="hidden" name="storagePath" value={resume.storagePath} />
                        <input type="hidden" name="sourceHash" value={resume.sourceHash} />
                        <Button type="submit" variant="secondary" size="sm">
                          Re-run extraction
                        </Button>
                      </form>
                    ) : (
                      <Link href="/dashboard/upload">
                        <Button variant="secondary" size="sm">
                          Upload a new resume
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm md:col-span-2">
          <h2 className="font-semibold mb-3">Overview</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Headline</div>
              <div className="text-sm">{profile?.headline ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Email</div>
              <div className="text-sm">{profile?.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">LinkedIn</div>
              <div className="text-sm">
                {(() => {
                  const raw = typeof profile?.linkedIn === "string" ? profile.linkedIn.trim() : "";
                  const val = raw && raw.toLowerCase() !== "null" ? raw : "";
                  if (!val) return "—";
                  const href = /^(https?:)?\/\//i.test(val) ? val : `https://${val}`;
                  return <a className="underline" href={href} target="_blank" rel="noreferrer">{val}</a>;
                })()}
              </div>
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Website</div>
              <div className="text-sm">
                {(() => {
                  const raw = typeof profile?.website === "string" ? profile.website.trim() : "";
                  const val = raw && raw.toLowerCase() !== "null" ? raw : "";
                  if (!val) return "—";
                  const href = /^(https?:)?\/\//i.test(val) ? val : `https://${val}`;
                  return <a className="underline" href={href} target="_blank" rel="noreferrer">{val}</a>;
                })()}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Location</div>
              <div className="text-sm">{[profile?.city, profile?.country].filter(Boolean).join(", ") || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Remote</div>
              <div className="text-sm">{profile?.remote === true ? "Yes" : profile?.remote === false ? "No" : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Relocation</div>
              <div className="text-sm">{profile?.relocation === true ? "Yes" : profile?.relocation === false ? "No" : "—"}</div>
            </div>
            {profile?.professionalSummary ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Summary</div>
                <p className="text-sm leading-relaxed">{profile.professionalSummary}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Status</h2>
          <p className="text-sm">{resume.lastProcessStatus}</p>
          <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Schema {resume.schemaVersion}</div>
          {resume.lastError && (
            <p className="text-sm text-red-600 mt-2">Error: {resume.lastError}</p>
          )}
        </div>
      </div>

      {skills.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span key={s} className="rounded-full border px-3 py-1 text-xs bg-[hsl(var(--muted))]">{s}</span>
            ))}
          </div>
        </div>
      )}

      {workExperiences.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Experience</h2>
          <ul className="space-y-4">
            {workExperiences.map((e, idx) => (
              <li key={idx} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{e?.jobTitle || "Role"} · {e?.company || "Company"}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {e?.startMonth ? String(e.startMonth).padStart(2, "0") : "—"}/{e?.startYear ?? "—"} — {e?.current ? "Present" : `${e?.endMonth ? String(e.endMonth).padStart(2, "0") : "—"}/${e?.endYear ?? "—"}`}
                  </div>
                </div>
                {e?.locationType && <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{e.locationType}</div>}
                {e?.description && <p className="text-sm mt-2 leading-relaxed whitespace-pre-line">{e.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {educations.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Education</h2>
          <ul className="space-y-3">
            {educations.map((ed, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                <div className="font-medium">{ed?.degree || "Degree"} — {ed?.school || "School"}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{ed?.startYear ?? "—"} — {ed?.endYear ?? "—"}</div>
                {ed?.major && <div className="w-full text-xs text-[hsl(var(--muted-foreground))]">{ed.major}</div>}
                {ed?.description && <div className="w-full text-xs text-[hsl(var(--muted-foreground))]">{ed.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {licenses.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Licenses & Certifications</h2>
          <ul className="space-y-2 text-sm">
            {licenses.map((lic, idx) => (
              <li key={idx} className="rounded-lg border p-4">
                <div className="font-medium">{lic?.name || "License"} — {lic?.issuer || "Issuer"}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{lic?.issueYear ?? "—"}</div>
                {lic?.description && <div className="text-xs mt-1">{lic.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {languages.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Languages</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {languages.map((lng, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>{lng?.language || "Language"}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{lng?.level || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {achievements.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Achievements</h2>
          <ul className="space-y-3">
            {achievements.map((a, idx) => (
              <li key={idx} className="rounded-lg border p-4">
                <div className="font-medium">{a?.title || "Achievement"} — {a?.organization || "Org"}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{a?.achieveDate || "—"}</div>
                {a?.description && <p className="text-sm mt-2 leading-relaxed">{a.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {publications.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Publications</h2>
          <ul className="space-y-3">
            {publications.map((p, idx) => (
              <li key={idx} className="rounded-lg border p-4">
                <div className="font-medium">{p?.title || "Title"} — {p?.publisher || "Publisher"}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{p?.publicationDate || "—"}</div>
                {p?.publicationUrl && (
                  <div className="text-xs"><a className="underline" href={p.publicationUrl} target="_blank" rel="noreferrer">{p.publicationUrl}</a></div>
                )}
                {p?.description && <p className="text-sm mt-2 leading-relaxed">{p.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {honors.length > 0 && (
        <div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Honors & Awards</h2>
          <ul className="space-y-3">
            {honors.map((h, idx) => (
              <li key={idx} className="rounded-lg border p-4">
                <div className="font-medium">{h?.title || "Honor"} — {h?.issuer || "Issuer"}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{h?.issueMonth ?? "—"}/{h?.issueYear ?? "—"}</div>
                {h?.description && <p className="text-sm mt-2 leading-relaxed">{h.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExportCopyButtons
              jsonText={JSON.stringify(resume.resumeData ?? {}, null, 2)}
              downloadName={`${resume.fileName.replace(/\.pdf$/i, "")}-resume.json`}
            />
          </div>
        </div>
        <CollapsibleJson
          jsonText={JSON.stringify(resume.resumeData ?? {}, null, 2)}
          initiallyCollapsed
          anchorId="raw-json"
        />
      </div>
    </div>
  );
}


