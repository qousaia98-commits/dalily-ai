/** Approved Dalily brand tokens — single source of truth */
export const BRAND = {
  name: "Dalily",
  nameAr: "دليلي",
  sloganEn: "From problem to solution",
  sloganAr: "من المشكلة إلى الحل",
  colors: {
    navy: "#0B1526",
    navyDeep: "#151F33",
    gold: "#C4A052",
    goldLight: "#D4B76A",
    white: "#F7F8FA",
    surface: "#F7F8FA",
    border: "#E4E7EE",
    muted: "#8A93A8",
    textSecondary: "#5C6478",
  },
  logo: {
    /** ~30% larger than Sprint 8 baseline (36px mark) */
    markSizeDesktop: 47,
    markSizeMobile: 40,
  },
} as const;

export { MARK_STAR_PATH, MARK_SWOOSH_PATH, MARK_GOLD_CX, MARK_GOLD_CY, MARK_GOLD_R } from "@/lib/brand/mark-svg";
