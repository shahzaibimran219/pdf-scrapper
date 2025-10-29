import { getServerSession } from "@/lib/auth";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  return (
    <div className="container py-8">
      

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl  bg-[hsl(var(--card))] p-4 h-fit sticky top-20">
          <SidebarNav />
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}


