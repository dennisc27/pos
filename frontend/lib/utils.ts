import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Currency = "DOP" | "USD";

export type MonetaryMetric = {
  amount: number;
  currency?: Currency;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/**
 * Format a monetary metric that is already expressed in display units.
 */
export function formatCurrency(metric: MonetaryMetric) {
  const {
    amount,
    currency = "DOP",
    locale = "en-US",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = metric;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(amount);
}

/**
 * Convert cents to display format (divide by 100) with two-decimal rounding.
 */
export function centsToDisplay(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Convert display format to cents (multiply by 100) with two-decimal rounding.
 */
export function displayToCents(display: number): number {
  return Math.round(display * 100);
}

export type ITBISBreakdown = {
  netCents: number;
  taxCents: number;
  totalCents: number;
  netDisplay: number;
  taxDisplay: number;
  totalDisplay: number;
};

/**
 * Calculate the ITBIS breakdown using the DR 18% tax rate.
 * Follows the spec: net = round(price * 0.82, 2); tax = price - net
 */
export function calculateITBISBreakdown(totalInCents: number): ITBISBreakdown {
  const totalDisplay = centsToDisplay(totalInCents);
  const netDisplay = Math.round(totalDisplay * 0.82 * 100) / 100;
  const taxDisplay = Math.round((totalDisplay - netDisplay) * 100) / 100;

  const netCents = displayToCents(netDisplay);
  const taxCents = totalInCents - netCents;

  return {
    netCents,
    taxCents,
    totalCents: totalInCents,
    netDisplay,
    taxDisplay,
    totalDisplay
  };
}

/**
 * Format a cent value into a localized currency string.
 */
export function formatCurrencyFromCents(
  cents: number,
  currency: Currency = "DOP",
  locale = "en-US"
): string {
  const display = centsToDisplay(cents);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(display);
}