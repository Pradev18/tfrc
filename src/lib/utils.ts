import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "QAR"): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function parsePriceString(value: unknown): number | null {
  if (value == null || value === "") return null;
  const str = String(value).replace(/[^\d.]/g, "");
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
