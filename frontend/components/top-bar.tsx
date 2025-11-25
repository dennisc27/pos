"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Calculator,
  Gavel,
  Handshake,
  Loader2,
  MoonStar,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  SunMedium,
  UserRound,
  Wrench,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { useTheme } from "@/components/providers/theme-provider";

type CalculatorButton = {
  label: string;
  action: () => void;
  variant: "muted" | "accent" | "default" | "primary";
  span?: number;
};

function formatResult(value: number) {
  if (!Number.isFinite(value)) {
    return "Error";
  }
  const formatted = value.toFixed(10);
  return formatted.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function TopBar() {
  const { branch, loading: branchLoading, error: branchError } = useActiveBranch();
  const { user, loading: userLoading } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<"add" | "subtract" | "multiply" | "divide" | null>(null);
  const [overwriteDisplay, setOverwriteDisplay] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  const closeCalculator = useCallback(() => {
    setIsCalculatorOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    setDisplayValue("0");
    setAccumulator(null);
    setPendingOperator(null);
    setOverwriteDisplay(true);
  }, []);

  const evaluatePending = useCallback(
    (nextOperator: typeof pendingOperator | "equals") => {
      const currentValue = Number(displayValue);
      if (!Number.isFinite(currentValue)) {
        handleClear();
        if (nextOperator !== "equals") {
          setPendingOperator(nextOperator);
        }
        return;
      }

      if (accumulator === null) {
        setAccumulator(nextOperator === "equals" ? null : currentValue);
        if (nextOperator === "equals") {
          setDisplayValue(formatResult(currentValue));
        }
      } else if (pendingOperator) {
        let result = accumulator;
        if (pendingOperator === "add") {
          result = accumulator + currentValue;
        } else if (pendingOperator === "subtract") {
          result = accumulator - currentValue;
        } else if (pendingOperator === "multiply") {
          result = accumulator * currentValue;
        } else if (pendingOperator === "divide") {
          result = currentValue === 0 ? NaN : accumulator / currentValue;
        }

        if (!Number.isFinite(result)) {
          setDisplayValue("Error");
          setAccumulator(null);
          setPendingOperator(null);
          setOverwriteDisplay(true);
          return;
        }

        setAccumulator(nextOperator === "equals" ? null : result);
        setDisplayValue(formatResult(result));
      }

      setPendingOperator(nextOperator === "equals" ? null : nextOperator);
      setOverwriteDisplay(true);
    },
    [accumulator, displayValue, handleClear, pendingOperator]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      setDisplayValue((previous) => {
        if (overwriteDisplay || previous === "0" || previous === "Error") {
          setOverwriteDisplay(false);
          return digit;
        }

        return previous + digit;
      });
    },
    [overwriteDisplay]
  );

  const handleDecimal = useCallback(() => {
    setDisplayValue((previous) => {
      if (overwriteDisplay || previous === "Error") {
        setOverwriteDisplay(false);
        return "0.";
      }
      if (previous.includes(".")) {
        return previous;
      }
      return `${previous}.`;
    });
  }, [overwriteDisplay]);

  const handleOperator = useCallback(
    (operator: typeof pendingOperator) => {
      evaluatePending(operator);
    },
    [evaluatePending]
  );

  const handleEquals = useCallback(() => {
    evaluatePending("equals");
  }, [evaluatePending]);

  const handleBackspace = useCallback(() => {
    setDisplayValue((previous) => {
      if (overwriteDisplay || previous === "Error") {
        return "0";
      }
      if (previous.length <= 1) {
        return "0";
      }
      return previous.slice(0, -1);
    });
  }, [overwriteDisplay]);

  const handleToggleSign = useCallback(() => {
    setDisplayValue((previous) => {
      if (previous === "0" || previous === "Error") {
        return previous === "Error" ? "0" : previous;
      }
      if (previous.startsWith("-")) {
        return previous.slice(1);
      }
      return `-${previous}`;
    });
  }, []);

  useEffect(() => {
    if (!isCalculatorOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCalculator();
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        handleDigit(event.key);
        return;
      }

      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        handleDecimal();
        return;
      }

      if (event.key === "+") {
        event.preventDefault();
        handleOperator("add");
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        handleOperator("subtract");
        return;
      }

      if (event.key === "*") {
        event.preventDefault();
        handleOperator("multiply");
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        handleOperator("divide");
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        handleEquals();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        handleBackspace();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCalculator, handleBackspace, handleDecimal, handleDigit, handleEquals, handleOperator, isCalculatorOpen]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isQuickCreateOpen) {
      return;
    }

    const handleClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsQuickCreateOpen(false);
      }
    };

    window.addEventListener("keydown", handleClose);
    return () => window.removeEventListener("keydown", handleClose);
  }, [isQuickCreateOpen]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const quickCreateItems = useMemo(
    () => [
      { label: "Pawn", href: "/loans/new", icon: Gavel },
      { label: "Sale", href: "/pos/new", icon: ShoppingBag },
      { label: "Layaway", href: "/layaway/new", icon: Package },
      { label: "Purchase", href: "/purchases/new", icon: ShoppingCart },
      { label: "Buy", href: "/pos/buy", icon: Handshake },
      { label: "Refund", href: "/pos/refund", icon: RotateCcw },
      { label: "Repair", href: "/repairs/intake", icon: Wrench },
      { label: "Customer", href: "/crm/customers", icon: UserRound }
    ],
    []
  );

  const handleGlobalSearch = useCallback(() => {
    const query = globalSearch.trim();
    if (!query) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }, [globalSearch, router]);

  const calculatorButtons = useMemo<CalculatorButton[]>(
    () => [
      { label: "C", action: handleClear, variant: "muted" as const },
      { label: "⌫", action: handleBackspace, variant: "muted" as const },
      { label: "÷", action: () => handleOperator("divide"), variant: "accent" as const },
      { label: "×", action: () => handleOperator("multiply"), variant: "accent" as const },
      { label: "7", action: () => handleDigit("7"), variant: "default" as const },
      { label: "8", action: () => handleDigit("8"), variant: "default" as const },
      { label: "9", action: () => handleDigit("9"), variant: "default" as const },
      { label: "-", action: () => handleOperator("subtract"), variant: "accent" as const },
      { label: "4", action: () => handleDigit("4"), variant: "default" as const },
      { label: "5", action: () => handleDigit("5"), variant: "default" as const },
      { label: "6", action: () => handleDigit("6"), variant: "default" as const },
      { label: "+", action: () => handleOperator("add"), variant: "accent" as const },
      { label: "1", action: () => handleDigit("1"), variant: "default" as const },
      { label: "2", action: () => handleDigit("2"), variant: "default" as const },
      { label: "3", action: () => handleDigit("3"), variant: "default" as const },
      { label: "=", action: handleEquals, variant: "primary" as const },
      { label: "0", action: () => handleDigit("0"), variant: "default" as const, span: 2 },
      { label: ".", action: handleDecimal, variant: "default" as const },
      { label: ",", action: handleDecimal, variant: "default" as const },
      { label: "±", action: handleToggleSign, variant: "muted" as const }
    ],
    [handleBackspace, handleClear, handleDecimal, handleDigit, handleEquals, handleOperator, handleToggleSign]
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-sm text-slate-600 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200">
          <Store className="h-4 w-4 text-sky-500 dark:text-sky-400" />
          {branchLoading ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando sucursal…
            </span>
          ) : branch ? (
            <span className="truncate">{branch.name}</span>
          ) : branchError ? (
            <span className="truncate text-rose-500">{branchError}</span>
          ) : (
            <span className="truncate">Sucursal no configurada</span>
          )}
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        <button
          type="button"
          onClick={() => setIsQuickCreateOpen(true)}
          className="hidden h-9 items-center justify-center rounded-full border border-slate-200/70 bg-white px-3 text-sm font-medium text-slate-600 transition hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white lg:flex"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo
        </button>
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 lg:flex">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search customers, tickets, receipts..."
            className="w-64 bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setGlobalSearch("");
              }
              if (event.key === "Enter") {
                event.preventDefault();
                handleGlobalSearch();
              }
            }}
          />
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-500 transition hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsCalculatorOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-500 transition hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
          aria-haspopup="dialog"
          aria-expanded={isCalculatorOpen}
        >
          <Calculator className="h-4 w-4" />
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
          <span className="font-medium">{userLoading ? "Cargando..." : user?.fullName ?? "Usuario"}</span>
        </div>
      </div>
      {isClient && isQuickCreateOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur"
              role="dialog"
              aria-modal="true"
              onClick={() => setIsQuickCreateOpen(false)}
            >
              <div
                className="w-full max-w-lg rounded-2xl border border-slate-200/70 bg-white p-5 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">New</p>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick create</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                    aria-label="Close quick create menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {quickCreateItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsQuickCreateOpen(false)}
                      className="flex items-center gap-3 rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <item.icon className="h-4 w-4 text-slate-500" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {isClient && isCalculatorOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-6 bg-slate-950/60 backdrop-blur"
              onClick={closeCalculator}
            >
              <div
                className="w-full max-w-sm rounded-3xl border border-slate-200/70 bg-white p-5 shadow-2xl outline-none dark:border-slate-800/80 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">Quick calculator</span>
                  <button
                    type="button"
                    onClick={closeCalculator}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                    aria-label="Close calculator"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-right text-2xl font-semibold tracking-tight text-slate-900 shadow-inner dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                  {displayValue}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {calculatorButtons.map((button) => (
                    <button
                      key={button.label}
                      type="button"
                      onClick={button.action}
                      className={cn(
                        "flex h-12 items-center justify-center rounded-xl border text-base font-medium transition",
                        button.span === 2 ? "col-span-2" : undefined,
                        button.variant === "primary"
                          ? "border-sky-500 bg-sky-500 text-white shadow hover:bg-sky-600"
                          : button.variant === "accent"
                            ? "border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600"
                            : button.variant === "muted"
                              ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700"
                      )}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}
