import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Currency = "DOP" | "USD";

type MonetaryMetric = {
  amount: number;
  currency?: Currency;
};

export function formatCurrency(metric: MonetaryMetric) {
  const currency = metric.currency ?? "DOP";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(metric.amount);
  // Replace "DOP" with "$" to save space
  return formatted.replace(/DOP\s*/g, "$");
}

/**
 * Convert cents to display format (divide by 100)
 */
export function centsToDisplay(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Convert display format to cents (multiply by 100)
 */
export function displayToCents(display: number): number {
  return Math.round(display * 100);
}

/**
 * Calculate ITBIS breakdown: net = round(price*0.82,2); tax = price - net
 */
export function calculateITBISBreakdown(priceInCents: number): {
  net: number;
  tax: number;
  total: number;
} {
  const price = centsToDisplay(priceInCents);
  const net = Math.round(price * 0.82 * 100) / 100; // Round to 2 decimal places
  const tax = price - net;
  
  return {
    net: displayToCents(net),
    tax: displayToCents(tax),
    total: priceInCents
  };
}

/**
 * Format currency from cents to display string
 */
export function formatCurrencyFromCents(cents: number, currency: Currency = "DOP"): string {
  const display = centsToDisplay(cents);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(display);
  // Replace "DOP" with "$" to save space
  return formatted.replace(/DOP\s*/g, "$");
}

export function formatDateForDisplay(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) {
    return false;
  }

  return startDate <= endDate;
}