import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export const metadata: Metadata = {
  title: "Pawn & POS Command Center",
  description:
    "Operational dashboard for pawn, retail, repairs, and compliance in one workspace."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
