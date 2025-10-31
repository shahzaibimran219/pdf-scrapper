import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/lib/auth";
import HistoryFilters from "@/components/history/HistoryFilters";
import Pagination from "@/components/history/Pagination";
import { Suspense } from "react";
import type { ResumeListItem } from "@/types/resume";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ITEMS_PER_PAGE = 10;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const session = await getServerSession();
  const sp = await searchParams;
  const q = sp?.q?.toString()?.trim() ?? "";
  const status = sp?.status?.toString()?.trim().toUpperCase();
  const page = Math.max(1, parseInt(sp?.page?.toString() ?? "1", 10));

  const where: Prisma.ResumeWhereInput | undefined = session?.user?.id ? { userId: session.user.id } : undefined;
  if (where) {
    if (q) where.fileName = { contains: q, mode: "insensitive" };
    if (status === "PENDING" || status === "SUCCEEDED" || status === "FAILED") {
      where.lastProcessStatus = status as "PENDING" | "SUCCEEDED" | "FAILED";
    }
  }

  const [resumes, total] = where
    ? await Promise.all([
        prisma.resume.findMany({
          where,
          orderBy: { uploadedAt: "desc" },
          skip: (page - 1) * ITEMS_PER_PAGE,
          take: ITEMS_PER_PAGE,
          select: { id: true, fileName: true, uploadedAt: true, fileSize: true, lastProcessStatus: true },
        }),
        prisma.resume.count({ where }),
      ])
    : [[], 0] as [ResumeListItem[], number];

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  function formatSize(bytes?: number | null) {
    const b = bytes ?? 0;
    if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }
  return (
    <div className="rounded-2xl border bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-[hsl(var(--popover))]">
        <HistoryFilters initialQ={q} initialStatus={status ?? ""} />
        <div className="hidden sm:block text-xs text-[hsl(var(--muted-foreground))]">{total} result{total === 1 ? "" : "s"}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="py-3 pl-5 pr-4 text-left font-medium">File</th>
              <th className="py-3 px-4 text-left font-medium">Date</th>
              <th className="py-3 px-4 text-left font-medium">Size</th>
              <th className="py-3 px-4 text-left font-medium">Status</th>
              <th className="py-3 pr-5 pl-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resumes.map((r) => (
              <tr key={r.id} className="hover:bg-[hsl(var(--muted))]/50 transition-colors">
                <td className="py-3 pl-5 pr-4">
                  <a href={`/resumes/${r.id}`} className="font-medium hover:underline">{r.fileName}</a>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">{new Date(r.uploadedAt).toLocaleString()}</td>
                <td className="py-3 px-4 whitespace-nowrap">{formatSize(r.fileSize)}</td>
                <td className="py-3 px-4">
                  {r.lastProcessStatus === "SUCCEEDED" && <Badge intent="success">Succeeded</Badge>}
                  {r.lastProcessStatus === "PENDING" && <Badge intent="warning">Pending</Badge>}
                  {r.lastProcessStatus === "FAILED" && <Badge intent="danger">Failed</Badge>}
                </td>
                <td className="py-3 pr-5 pl-4 text-right">
                  <a href={`/resumes/${r.id}`} className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--muted))]">Open</a>
                </td>
              </tr>
            ))}
            {resumes.length === 0 && (
              <tr>
                <td className="py-6 text-center text-[hsl(var(--muted-foreground))]" colSpan={5}>No uploads yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 0 && (
        <Suspense fallback={<div className="px-4 py-3 border-t bg-[hsl(var(--popover))] text-xs text-[hsl(var(--muted-foreground))]">Loading pagination...</div>}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </Suspense>
      )}
    </div>
  );
}


