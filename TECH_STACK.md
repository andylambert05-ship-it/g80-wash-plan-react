# BMW M3 Competition xDrive Care Plan — Tech Stack Document

**Repository:** `andylambert05-ship-it/g80-wash-plan-react`  
**Live URL:** `andylambert05-ship-it.github.io/g80-wash-plan-react/`  
**Version:** 2.3 · Last Updated: 2026-05-30

---

## 1. Overview

The G80 M3 Care Plan is a Progressive Web App (PWA) built with React and Vite, deployed to GitHub Pages via automated GitHub Actions CI/CD. It serves as a comprehensive car-care reference tool covering wash steps, chemical dilutions, tools, interior detail, engine bay, seasonal guidance, upgrade tracking, and a between-wash checklist.

The app is designed for real-world mobile use at the wash bay — it works fully offline, can be installed to the home screen, uses a BMW M-inspired dark theme, and includes wash-day features such as countdown timers with wake lock, haptic step feedback, pull-to-refresh, and a persistent upgrades tracker.

---

## 2. Tech Stack

### 2.1 Core Framework

| Technology | Details |
|---|---|
| React | 18.3.1 — functional components and hooks throughout; no class components except ErrorBoundary |
| Vite | 5.4.2 — build tool and dev server; base path `/g80-wash-plan-react/` for GitHub Pages sub-path |
| JavaScript | ES Modules (`type: module`); no TypeScript |
| CSS | Vanilla CSS via `index.css`; CSS custom properties for theming; no Tailwind or CSS-in-JS |
| Icons | Tabler Icons Web Font loaded from CDN; used throughout step cards, tabs, and UI chrome |

### 2.2 Dependencies

Production dependencies are minimal by design:

| Package | Version / Purpose |
|---|---|
| `react` | ^18.3.1 — UI framework |
| `react-dom` | ^18.3.1 — DOM rendering |
| `@vitejs/plugin-react` | ^4.3.1 — Vite plugin for JSX transform and HMR (dev) |
| `vite` | ^5.4.2 — build tool (dev) |

No state management library (Redux, Zustand, etc.). All state is handled via React hooks and localStorage.

### 2.3 Data Layer

| Item | Details |
|---|---|
| Data source | `public/wash-plan.json` — single JSON file serving all app data |
| Fetch strategy | Fetched on mount via `fetch()` in `App.jsx` useEffect; cache-busted on pull-to-refresh |
| Schema | `meta`, `washSteps` (normal + maintOnly arrays), `chemicals`, `tools`, `engineBay`, `interiorDetail`, `betweenWash`, `seasonalNotes`, `upgrades` |
| Update workflow | Edit `wash-plan.json` locally, `git push`; GitHub Actions rebuilds and deploys automatically |

---

## 3. Application Architecture

### 3.1 File Structure

```
g80-wash-plan-react/
  index.html                  Entry point — PWA meta, boot splash, SW registration
  vite.config.js              Vite config — base path for GitHub Pages
  package.json                Dependencies and scripts
  public/
    wash-plan.json            All app data
    manifest.webmanifest      PWA manifest
    sw.js                     Service worker
    icon-192.png              PWA icons (192, 512, maskable, apple-touch)
    favicon.svg/.ico/.png     Favicons for browser tab
  src/
    main.jsx                  React root mount + boot splash dismiss
    App.jsx                   Root component — layout, routing, state wiring
    index.css                 All styles — CSS variables, component styles
    constants.js              Phase/season colors, helper functions
    hooks/
      useTimer.js             Countdown timer + wake lock + audio beep + vibration
      useWashState.js         localStorage persistence + daily auto-reset + haptics
      usePullToRefresh.js     Touch gesture handler for pull-to-refresh
    components/
      StepCard.jsx            Individual wash step card + PhaseHeader export
      TabSteps.jsx            Steps tab — progress, phase groups, step list
      TabChemicals.jsx        Chemicals tab — quick chart + full dilution cards
      TabUpgrades.jsx         Upgrades tab — phases, done toggle, add form
      Tabs.jsx                ShortList, Tools, Interior, Engine, Between, Seasonal
      FloatingTimer.jsx       Fixed floating countdown ring (bottom-right)
      ResetButton.jsx         Two-tap confirm reset button (reusable)
      BMWMLogo.jsx            Unused SVG component (retained for reference)
  .github/workflows/
    deploy.yml                GitHub Actions CI/CD pipeline
```

### 3.2 Component Map

| Tab | Component / Source |
|---|---|
| Steps | `TabSteps.jsx` + `StepCard.jsx` — reads `washSteps` from JSON |
| Chemicals | `TabChemicals.jsx` — reads `chemicals` array from JSON |
| ShortList | `Tabs.jsx` (TabShortList) — static arrays in component |
| Tools | `Tabs.jsx` (TabTools) — reads `tools` array from JSON |
| Interior | `Tabs.jsx` (TabInterior) — reads `interiorDetail` from JSON |
| Engine Bay | `Tabs.jsx` (TabEngine) — reads `engineBay` from JSON |
| Between Washes | `Tabs.jsx` (TabBetweenWash) — reads `betweenWash` from JSON |
| Seasonal | `Tabs.jsx` (TabSeasonal) — reads `seasonalNotes` from JSON |
| Upgrades | `TabUpgrades.jsx` — reads `upgrades` from JSON + localStorage |

---

## 4. State Management

### 4.1 useWashState Hook

Custom hook handling all wash-related state with localStorage persistence:

- **Wash mode** (`normal` / `maint`) — persisted to `gwp_mode`
- **Step completion sets** (`done`, `engDone`, `intDone`) — persisted to `gwp_done`, `gwp_eng`, `gwp_int`
- **Daily auto-reset** — `gwp_date` checked on mount; if date has changed, `gwp_done` and `gwp_eng` are cleared
- **Haptic feedback** — 12ms vibration via `navigator.vibrate()` on every toggle
- **Upgrade done state** — persisted separately to `gwp_upgrades` (no auto-reset)
- **Custom upgrades** — user-added items persisted to `gwp_custom_upgrades`

### 4.2 useTimer Hook

Manages dwell countdown timers for chemical steps:

- Accepts `seconds`, `label`, and optional `activeId` (step identifier for visual highlight)
- Runs `setInterval` countdown; updates `remaining` and `done` state
- **Wake Lock API** — requests screen wake lock on start, releases on completion or stop
- **Audio alert** — three 880Hz beeps via Web Audio API on timer expiry
- **Vibration** — 300/150/300ms pattern on expiry
- Auto-reacquires wake lock on page visibility change if timer is running

### 4.3 usePullToRefresh Hook

Touch gesture handler for pull-to-refresh:

- Activates only when `window.scrollY === 0` (scrolled to top)
- Tracks `touchstart` / `touchmove` / `touchend`; applies 0.5× resistance to pull distance
- Threshold: 80px to trigger; maximum visual pull: 120px
- On release past threshold: calls `onRefresh()`, shows spinner for minimum 2 seconds
- Prevents default `touchmove` past 30px pull to suppress native browser pull behavior

---

## 5. Progressive Web App (PWA)

### 5.1 Manifest

| Property | Value |
|---|---|
| `name` | BMW M3 Competition xDrive Care Plan |
| `short_name` | M3 Care |
| `display` | `standalone` — launches without browser chrome |
| `theme_color` | `#0d0d0d` — matches app background |
| `background_color` | `#0d0d0d` |
| `icons` | 192px, 512px (any), 512px maskable — M-stripe on black |
| `start_url` | `/g80-wash-plan-react/` |

### 5.2 Service Worker (`sw.js`)

| Strategy | Applied to |
|---|---|
| Network-first, cache fallback | HTML navigation, `index.html`, `wash-plan.json` |
| Cache-first, network fallback | JS bundles, CSS, icons, fonts |
| Cache version | `m3care-v2` — bump to force cache purge on next deploy |
| Offline behavior | Serves cached app shell; JSON falls back to last cached version |

The service worker is registered in `index.html` after the app loads. On install it pre-caches the core app shell. On activate it purges all caches with a different version key.

### 5.3 Boot Splash

A pure CSS boot splash is injected directly in `index.html` and displays immediately before React mounts. Three M-stripe bars animate with a staggered pulse (`bootpulse` keyframes, 0/0.18/0.36s delays). The splash is hidden after 3 seconds via a `setTimeout` in `main.jsx`, with a 450ms CSS opacity fade-out before DOM removal.

---

## 6. Deployment & CI/CD

### 6.1 GitHub Actions Pipeline

Defined in `.github/workflows/deploy.yml`. Triggers on every push to `main`.

| Step | Action |
|---|---|
| 1. Checkout | `actions/checkout@v4` |
| 2. Node setup | `actions/setup-node@v4` — Node 20, npm cache |
| 3. Install | `npm ci` — clean install from `package-lock.json` |
| 4. Build | `npm run build` — Vite production build to `dist/` |
| 5. Upload artifact | `actions/upload-pages-artifact@v3` — uploads `dist/` |
| 6. Deploy | `actions/deploy-pages@v4` — deploys to GitHub Pages |

Typical deploy time: ~60 seconds from push to live. Concurrent deploys are cancelled (`cancel-in-progress: true`).

### 6.2 Update Workflow

**Content updates** (`wash-plan.json` only):
```bash
edit public/wash-plan.json
git add public/wash-plan.json && git commit -m "description" && git push
```

**App / UI updates** (components, CSS):
```bash
edit src/ files
git add . && git commit -m "description" && git push
```

---

## 7. Design System

### 7.1 Color Palette

| Variable | Value / Usage |
|---|---|
| `--bg` | `#0d0d0d` — app background |
| `--card` | `#111111` — step and chem cards |
| `--card2` | `#161616` — secondary card / table headers |
| `--t1` | `#f0f0f0` — primary text |
| `--t2` | `#aaaaaa` — secondary text / step descriptions |
| `--t3` | `#888888` — tertiary text / labels |
| M Blue (`--blue`) | `#0066b1` — BMW M middle stripe; timer ring, mode buttons, step spine |
| M Navy | `#1c2e6e` — BMW M left stripe; header accent |
| M Red (`--red`) | `#cc1e1e` — BMW M right stripe; progress bar |
| IOM Green (`--iom`) | `#1a9e62` — Isle of Man Green; active tab underline |
| `--amber` | `#c8860a` — dwell time pills and warnings |

### 7.2 Typography

| Element | Style |
|---|---|
| Font family | Inter (Google Fonts CDN), fallback `-apple-system, sans-serif` |
| Weights | 300 body, 500 step titles, 700 labels/headings |
| Tab labels | 9px, 700, uppercase, letter-spacing 0.12em |
| Step titles | 11px, 700, uppercase, letter-spacing 0.04em |
| Step body | 12px, 300, line-height 1.6 |
| Phase headers | 13px, 700, uppercase, letter-spacing 0.14em |

### 7.3 M Tricolor Stripe

The BMW M tricolor stripe appears in two places:

- **Header** — 3 divs, `gap: 1px`, `width: 14px`, `height: 30px`, `transform: skewX(-26deg)`
- **Boot splash** — scaled up: `width: 18px`, `height: 46px`, staggered pulse animation

Colors in order: `#1c2e6e` (dark navy) → `#0066b1` (blue) → `#cc1e1e` (red). The stripe also appears in all favicon assets (SVG, ICO, 16px and 32px PNG) with transparent background.

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| JSON as data source | No database needed. All data is read-only from the app's perspective. Editing JSON and pushing is a simple, low-friction update workflow. |
| No state management library | App state is simple enough for `useState` + `useEffect` + custom hooks. Redux/Zustand would be over-engineering. |
| Vanilla CSS | Full control over the BMW M dark theme. CSS custom properties provide theming without framework overhead. |
| Network-first for HTML/JSON | Ensures content updates appear immediately when online, while still working offline via cache fallback. JS/CSS bundles are cache-first because they are immutably hashed by Vite. |
| Daily auto-reset for steps | Wash steps are checked off during a single session. Auto-reset each day ensures a clean slate. Upgrades are one-time milestones and never auto-reset. |
| ShortList as static arrays | The ShortList is a curated quick-reference, not a computed view. Hardcoded arrays give precise control over order and content, independent of the JSON schema. |
| localStorage for custom upgrades | User-added upgrades save instantly without a GitHub push. Items can be promoted to JSON for permanent cross-device storage. |
| ErrorBoundary on Upgrades tab | Integrates localStorage + JSON data. Prevents any rendering error from crashing the entire app. |

---

## 9. Known Limitations

- **Haptic feedback** (`navigator.vibrate`) is not supported on iOS Safari. Works on Android only.
- **Wake Lock API** may not be available on all mobile browsers; failures are silently caught.
- **Custom upgrades** are device-local only. Must be manually added to `wash-plan.json` to persist across devices or after clearing browser data.
- **ShortList** contains hardcoded chemical lists. If `wash-plan.json` chemicals are updated, `Tabs.jsx` must also be manually updated to stay in sync.
- **Service worker cache** must be manually cleared after a cache version bump, or the browser continues serving stale assets until the old SW is replaced.
- **Pull-to-refresh** is touch-only. Desktop users must use a standard browser refresh.
