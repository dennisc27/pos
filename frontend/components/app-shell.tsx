"use client";

import { ActiveBranchProvider } from "@/components/providers/active-branch-provider";
import { CurrentUserProvider } from "@/components/providers/current-user-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ActiveBranchProvider>
        <CurrentUserProvider>
          <div className="flex min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <TopBar />
              <main className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-6">{children}</main>
            </div>
          </div>
        </CurrentUserProvider>
      </ActiveBranchProvider>
    </ThemeProvider>
  );
}
