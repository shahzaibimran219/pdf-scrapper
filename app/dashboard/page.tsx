import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - PDF Resume Scrapper",
  description: "Dashboard for managing your PDF resume extractions",
};

export default function DashboardPage() {
  redirect("/dashboard/upload");
}


