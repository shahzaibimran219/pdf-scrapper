import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Header from "./header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Resume Scrapper",
  description: "PDF Resume Scrapper is a tool that allows you to scrape data like text, images, and other data from PDF resumes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen`}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(1000px_400px_at_10%_-10%,#dbeafe,transparent),radial-gradient(800px_300px_at_90%_-20%,#f5f5f4,transparent)]" />
        <Header />
        {children}
        <Footer />
        <Toaster richColors />
      </body>
    </html>
  );
}
