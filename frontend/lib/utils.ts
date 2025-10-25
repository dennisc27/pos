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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(metric.amount);
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(display);
}