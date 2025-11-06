import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

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
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
