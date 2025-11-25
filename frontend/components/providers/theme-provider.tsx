"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-theme", theme);
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [loading, setLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings?scope=global&keys=appearance.settings`);
      if (!response.ok) {
        throw new Error("Failed to load theme");
      }
      const data = await response.json();
      const appearanceEntry = data.entries?.find((entry: { key: string }) => entry.key === "appearance.settings");
      
      if (appearanceEntry?.value?.theme === "dark" || appearanceEntry?.value?.theme === "light") {
        setThemeState(appearanceEntry.value.theme);
        applyTheme(appearanceEntry.value.theme);
      } else {
        // Fallback to localStorage if database doesn't have theme
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("command-center-theme") : null;
        if (stored === "light" || stored === "dark") {
          setThemeState(stored);
          applyTheme(stored);
        } else {
          applyTheme("light");
        }
      }
    } catch (error) {
      console.error("Failed to load theme from database:", error);
      // Fallback to localStorage
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("command-center-theme") : null;
      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
        applyTheme(stored);
      } else {
        applyTheme("light");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const setTheme = useCallback(
    async (newTheme: Theme) => {
      setThemeState(newTheme);
      applyTheme(newTheme);

      // Update localStorage as backup
      if (typeof window !== "undefined") {
        window.localStorage.setItem("command-center-theme", newTheme);
      }

      // Update database - first load current appearance settings to preserve other values
      try {
        const loadResponse = await fetch(`${API_BASE_URL}/api/settings?scope=global&keys=appearance.settings`);
        let currentAppearance = {
          theme: newTheme,
          dashboardLayout: "command" as const,
        };

        if (loadResponse.ok) {
          const loadData = await loadResponse.json();
          const appearanceEntry = loadData.entries?.find((entry: { key: string }) => entry.key === "appearance.settings");
          if (appearanceEntry?.value) {
            currentAppearance = {
              ...appearanceEntry.value,
              theme: newTheme,
            };
          }
        }

        const response = await fetch(`${API_BASE_URL}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "global",
            entries: [
              {
                key: "appearance.settings",
                value: currentAppearance,
              },
            ],
          }),
        });

        if (!response.ok) {
          console.error("Failed to save theme to database");
        }
      } catch (error) {
        console.error("Error saving theme to database:", error);
      }
    },
    []
  );

  return <ThemeContext.Provider value={{ theme, setTheme, loading }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

