# Dalily Brand Kit

Complete visual identity for **Dalily** — the AI-powered platform that helps people solve real-world problems by finding the best local service providers.

> **Slogan (EN):** From problem to solution.  
> **Slogan (AR):** من المشكلة إلى الحل

---

## Brand Positioning

| Attribute | Expression |
|-----------|------------|
| Trust | Stable D stem, navy palette, verified tone |
| Simplicity | Flat geometry, no effects |
| Intelligence | Search lens inside the mark |
| Speed | Focal gold point = solution found |
| Premium | Navy + gold, refined typography |
| Human-centered | Bilingual identity (EN + AR) |

Dalily is **not** a directory. It is a problem-solving platform.

---

## The Dalily Mark

The symbol combines four ideas in one minimal form:

1. **Letter D** — brand initial, stability, trust  
2. **Search lens** — negative-space circle inside the D bowl  
3. **Navigation** — curved path guiding toward the center  
4. **Solution** — gold focal point at the destination  

No location pin. No map clichés. No gradients.

The mark alone must work at **16×16** through **512×512**.

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Navy Primary | `#0B1526` | Logo, headers, app icon background |
| Navy Deep | `#151F33` | Dark UI surfaces |
| Gold Accent | `#C4A052` | Focal point, CTAs, premium accents |
| Gold Light | `#D4B76A` | Hover states on dark backgrounds |
| White | `#FFFFFF` | Light backgrounds, mark on navy |
| Surface | `#F7F8FA` | Page backgrounds |
| Muted | `#8A93A8` | Secondary text, slogans |
| Text | `#5C6478` | Body secondary |

**Rules:** Flat colors only. No gradients, shadows, gloss, or 3D.

---

## Typography

### English — Plus Jakarta Sans (primary)

| Role | Size | Weight | Tracking |
|------|------|--------|----------|
| Display / Logo | 28–48px | Bold (700) | -2% to -3% |
| Headline | 24–32px | Bold (700) | -2% |
| Body | 16–18px | Medium (500) | 0% |
| Caption / Label | 11–12px | Semibold (600) | +6% to +8% |

**Alternates:** General Sans, Satoshi, Manrope

### Arabic — Noto Sans Arabic

| Role | Size | Weight |
|------|------|--------|
| Brand name | 16–20px | Medium (500) |
| Slogan | 13–16px | Medium (500) |

**Alternates:** IBM Plex Sans Arabic

---

## Logo System

### Files (`brand/assets/`)

| File | Description |
|------|-------------|
| `symbol.svg` | Mark only — favicon, app icon, social avatar |
| `logo-main.svg` | **[Icon] Dalily** + **دليلي** underneath |
| `logo-horizontal.svg` | Horizontal lockup + English slogan |
| `logo-vertical.svg` | Stacked lockup + bilingual slogan |
| `logo-dark.svg` | For light backgrounds (navy mark) |
| `logo-light.svg` | For dark backgrounds (white mark) |
| `logo-mono.svg` | Single-color (`currentColor`) |
| `app-icon.svg` | 512×512 master app icon |
| `favicon.svg` | 32×32 browser favicon |

### Layout — Main Logo

```
[Mark]  Dalily
        دليلي
```

### Versions

- **Dark version:** Navy mark on white/light surfaces  
- **Light version:** White mark on navy/dark surfaces  
- **Monochrome:** One ink color for print, emboss, watermark  

---

## Clear Space & Minimum Size

- **Clear space:** 1× mark height on all sides (X)  
- **Mark minimum:** 16px height  
- **Full logo minimum:** 120px total width  
- **App icon master:** 512×512px PNG export from `app-icon.svg`  

See `spacing-rules.svg` for visual reference.

---

## App Icon

- Symbol **only** — no text  
- Background: Navy `#0B1526`  
- Mark: White with gold focal point  
- Corner radius: ~22% (iOS-style squircle at 512px = 112px radius)  

Export sizes: 16, 32, 64, 128, 256, 512

---

## Mockups (`brand/mockups/`)

| File | Description |
|------|-------------|
| `mobile-splash.svg` | iOS/Android launch screen |
| `business-card.svg` | Front (navy) + back (white) |

---

## Usage Rules

### Do

- Use approved SVG files  
- Maintain proportions and clear space  
- Use dark logo on light; light logo on dark  
- Keep gold focal point visible  

### Do Not

- Add gradients, shadows, or 3D  
- Use location pins or map icons  
- Stretch, rotate, or outline the mark  
- Change gold to yellow or orange  
- Place on low-contrast photography  

See `usage-examples.svg`.

---

## CSS Design Tokens

```css
:root {
  --dalily-navy: #0B1526;
  --dalily-navy-deep: #151F33;
  --dalily-gold: #C4A052;
  --dalily-gold-light: #D4B76A;
  --dalily-white: #FFFFFF;
  --dalily-surface: #F7F8FA;
  --dalily-muted: #8A93A8;
  --dalily-text-secondary: #5C6478;
  --dalily-font-sans: "Plus Jakarta Sans", "General Sans", "Satoshi", Manrope, system-ui, sans-serif;
  --dalily-font-arabic: "Noto Sans Arabic", "IBM Plex Sans Arabic", Tahoma, sans-serif;
}
```

---

## Export Checklist

- [ ] `logo-main.svg` → PDF for print  
- [ ] `app-icon.svg` → PNG 512, 192, 180, 32, 16  
- [ ] `favicon.svg` → deployed to `/public/favicon.svg`  
- [ ] Social: 1024×1024 avatar from `app-icon.svg`  
- [ ] Open Graph: 1200×630 with horizontal logo on navy  

---

## Folder Structure

```
brand/
├── BRAND-GUIDELINES.md    ← this file
├── README.md
├── preview.html           ← open in browser to review kit
├── tokens.css
├── assets/
│   ├── symbol.svg
│   ├── logo-main.svg
│   ├── logo-horizontal.svg
│   ├── logo-vertical.svg
│   ├── logo-dark.svg
│   ├── logo-light.svg
│   ├── logo-mono.svg
│   ├── app-icon.svg
│   ├── favicon.svg
│   ├── color-palette.svg
│   ├── typography.svg
│   ├── spacing-rules.svg
│   └── usage-examples.svg
└── mockups/
    ├── mobile-splash.svg
    └── business-card.svg
```

---

*Dalily Brand Identity — Series A ready. Designed for Syria, scalable across the Middle East.*
