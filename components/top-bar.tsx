"use client";

import { useEffect, useState } from "react";
import { Bell, MoonStar, Search, Store, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "command-center-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-theme", theme);
}

export function TopBar() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      applyTheme(stored);
      return;
    }
    applyTheme("light");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200">
          <Store className="h-4 w-4 text-sky-500 dark:text-sky-400" />
          <span>Santo Domingo - Main</span>
        </div>
        <div className="hidden items-center gap-3 text-xs text-slate-500 dark:text-slate-400 md:flex">
          <span>
            Shift: <span className="font-medium text-slate-700 dark:text-slate-200">Morning A</span>
          </span>
          <span>
            Drawer: <span className="font-medium text-emerald-500 dark:text-emerald-400">Balanced</span>
          </span>
          <span>
            Till Float: <span className="font-medium text-slate-700 dark:text-slate-200">RD$15,000</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 lg:flex">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search customers, tickets, receipts..."
            className="w-64 bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-500 transition hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border transition",
            theme === "dark"
              ? "border-slate-800 bg-slate-900 text-slate-200 hover:text-white"
              : "border-slate-200/70 bg-white text-slate-600 hover:text-slate-800"
          )}
          aria-pressed={theme === "dark"}
          aria-label={theme === "dark" ? "Activate light mode" : "Activate dark mode"}
        >
          {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        </button>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 lg:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <span className="font-medium">Maria P.</span>
        </div>
      </div>
    </header>
  );
}
