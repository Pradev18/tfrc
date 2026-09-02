import type { CSSProperties } from "react";
import type { EnvironmentConfig } from "@/lib/environments";

/** Per-environment visual tokens for premium UI */
export interface EnvVisual {
  heroFrom: string;
  heroTo: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  heading: string;
  body: string;
  muted: string;
  border: string;
  surface: string;
  sectionAlt: string;
  cta: string;
  ctaHover: string;
  ctaText: string;
  accent: string;
  cardShadow: string;
  gradientAccent: string;
  heroGradient?: string;
}

export const ENV_VISUALS: Record<string, EnvVisual> = {
  pawmart: {
    heroFrom: "#ffffff",
    heroTo: "#f0f7f4",
    glow: "rgba(45, 106, 79, 0.08)",
    badgeBg: "#edf7f1",
    badgeBorder: "#c8e6d4",
    badgeText: "#1b4332",
    heading: "#0f2922",
    body: "#3d5a50",
    muted: "#6b8f82",
    border: "#dceee5",
    surface: "#ffffff",
    sectionAlt: "#f7fbf9",
    cta: "#1b4332",
    ctaHover: "#0f2922",
    ctaText: "#ffffff",
    accent: "#40916c",
    cardShadow: "0 8px 40px rgba(27, 67, 50, 0.08)",
    gradientAccent: "linear-gradient(135deg, #d8f3dc 0%, #ffe8d6 100%)",
    heroGradient: "linear-gradient(165deg, #ffffff 0%, #eef7f2 45%, #e8f5ee 100%)",
  },
  hardware: {
    heroFrom: "#ffffff",
    heroTo: "#f1f5f9",
    glow: "rgba(30, 41, 59, 0.06)",
    badgeBg: "#f1f5f9",
    badgeBorder: "#cbd5e1",
    badgeText: "#0f172a",
    heading: "#0f172a",
    body: "#475569",
    muted: "#64748b",
    border: "#e2e8f0",
    surface: "#ffffff",
    sectionAlt: "#f8fafc",
    cta: "#0f172a",
    ctaHover: "#1e293b",
    ctaText: "#ffffff",
    accent: "#d97706",
    cardShadow: "0 8px 40px rgba(15, 23, 42, 0.1)",
    gradientAccent: "linear-gradient(135deg, #e2e8f0 0%, #fef3c7 100%)",
    heroGradient: "linear-gradient(165deg, #ffffff 0%, #f1f5f9 45%, #e8eef4 100%)",
  },
  household: {
    heroFrom: "#fffdfb",
    heroTo: "#faf6f0",
    glow: "rgba(120, 53, 15, 0.06)",
    badgeBg: "#fef7ed",
    badgeBorder: "#fed7aa",
    badgeText: "#7c2d12",
    heading: "#431407",
    body: "#78716c",
    muted: "#a8a29e",
    border: "#f5ebe0",
    surface: "#ffffff",
    sectionAlt: "#fffbf7",
    cta: "#9a3412",
    ctaHover: "#7c2d12",
    ctaText: "#ffffff",
    accent: "#ca8a04",
    cardShadow: "0 8px 40px rgba(120, 53, 15, 0.08)",
    gradientAccent: "linear-gradient(135deg, #ffedd5 0%, #fef9c3 100%)",
    heroGradient: "linear-gradient(165deg, #fffdfb 0%, #faf6f0 45%, #f5ebe0 100%)",
  },
};

export function getEnvVisual(slug: string): EnvVisual {
  return ENV_VISUALS[slug] ?? ENV_VISUALS.pawmart;
}

export function envStyle(v: EnvVisual): CSSProperties {
  return {
    "--env-heading": v.heading,
    "--env-body": v.body,
    "--env-muted": v.muted,
    "--env-border": v.border,
    "--env-surface": v.surface,
    "--env-section-alt": v.sectionAlt,
    "--env-cta": v.cta,
    "--env-cta-hover": v.ctaHover,
    "--env-cta-text": v.ctaText,
    "--env-accent": v.accent,
    "--env-badge-bg": v.badgeBg,
    "--env-badge-border": v.badgeBorder,
    "--env-badge-text": v.badgeText,
  } as CSSProperties;
}
