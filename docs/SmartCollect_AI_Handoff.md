# Handoff: SmartCollect AI — AR Collections Module

## Overview

SmartCollect AI is a net-new, AI-first Accounts Receivable Collections product for Tekion's accounting platform. It gives AR collectors a single intelligent workspace to prioritize, communicate, and predict recovery across their portfolio — replacing fragmented aging reports and manual workflows.

This feature was designed as a standalone module within the Tekion ARC product, accessed via the Accounting app's module navigation.

---

## About the Design Files

The files in this bundle are **design references created in HTML** — high-fidelity interactive prototypes showing intended layout, behavior, data, and component usage. They are **not production code**. Your task is to recreate these designs in the existing Tekion ARC React codebase using the established Arcade Design System components, patterns, and conventions — not to ship the HTML directly.

The prototype uses the Arcade Design System bundle (`_ds_bundle.js`) for all components. In the real codebase, import the same components from their canonical source paths.

---

## Fidelity

**High-fidelity.** The prototype is pixel-accurate with final colors, typography, spacing, component choices, and interactions. Recreate the UI pixel-perfectly using the Arcade Design System as documented.

---

## Design System

**Arcade Design System** (internal: `DSArcadeDesignSystem_c0f4b3`). All components, tokens, and typography must come from this system. Key references:

- Component library: `ui_kits/dms/`
- Tokens: `colors_and_type.css`
- Font: Proxima Nova — Regular (400) for body, SemiBold (600) for headings/labels
- Base radius: `--radius-xs` (2px) on all cards, inputs, modals
- Body font size: 14px / 22px line-height
- Page gutters: 24px (`--sp-lg`)
- Primary action color: `--brand-background-primary` (Tekion blue / denim)
- Selected surfaces: `--background-active` (#DBEBFF)

---

## Screens / Views

The module has **6 tabs** rendered inside the Tekion Shell + NavBar. The NavBar title is **"AR Insights"**. All tabs share a persistent **AI Query Bar** directly beneath the NavBar (see below).

---

### Shared: AI Query Bar

Sits between the NavBar and the tab strip on every screen. Full-width, white background, 1px `--border-primary` bottom border, 44px height, 24px horizontal padding.

**Left:** A search-input-style field (max-width 480px), `--background-secondary` fill, `--border-primary` border, `--radius-xs`, 36px height. Contains:
- Left: sparkle/star icon in `--brand-text-primary`
- Placeholder: contextual per tab (e.g., `Ask AI: "Who should I call first today?"`)

**Center:** 2 contextual AI suggestion chips. Each chip: `--background-active` fill, `--border-active` border, `--radius-xs`, 12px font, `--brand-text-primary` text, 28px height. Change per active tab.

**Right:** Secondary `Button` labeled "AI Copilot" — toggles the AI Copilot SideSheet.

---

### Tab 1: Dashboard

**Purpose:** Morning overview — what changed overnight, where to focus, today's cash potential.

**Layout:** Vertical stack with 24px gaps, 24px page gutters.

1. **NotificationBanner** (type: `information`) — AI Daily Brief. Title: "5 high-risk accounts totaling $7.9M require action today". Body: brief explanation + recommended first action. Primary CTA: "View Epsilon Motors" → navigates to Account Profile tab.

2. **KPI Row 1** — 4-column grid, 14px gaps. Four `Card` components:
   - Total Outstanding: `$9.55M` — navigates to Collection Queue (all)
   - Risk Alerts: `5` (value in `--error-text-primary`) — navigates to Collection Queue filtered to Critical
   - Projected Cash Flow: `$7.0M` — navigates to Collection Queue (all)
   - Active Disputes: `6` (value in `--warning-text-primary`) — navigates to Disputes tab

   Each card: title in header, large value (26px/600), 12px subtitle in `--text-tertiary`, 12px trend line. On hover: `box-shadow: 0 0 0 2px var(--brand-background-primary)`. "View details →" text in `--brand-text-primary` bottom-right.

3. **KPI Row 2** — 3-column grid, 14px gaps. Three `Card` components:
   - DSO Trend: `-12%` (in `--success-text-primary`) — all navigate to Collection Queue
   - Collection Rate: `87%`
   - Avg Time / Account: `2 min`

4. **Section header** — "Priority Worklist" (16px/600) + "7 accounts requiring attention" label + `Lozenge` (style: info, label: "AI Prioritized").

5. **Table** (no outer padding — full bleed, `--border-primary` top) — columns:
   - Account (multiline: name + industry)
   - Risk Level (`StatusWithLabel`)
   - Outstanding (amount bold + days past due in `--error-text-primary`)
   - AI Signals (12px `--text-secondary`)
   - Next Action (primary `Button` size small → navigates to Account Profile)

   Row click → navigates to Account Profile tab. Data: 7 accounts sorted by AI priority score.

---

### Tab 2: Collection Queue

**Purpose:** Full AI-ranked account list with priority scoring, filtering, and quick actions.

**Layout:** NotificationBanner → FilterBar → Table → Pagination (full bleed).

1. **NotificationBanner** (type: `information`) — AI summary of #1 priority account.

2. **FilterBar** — filters: Risk Level (select), Sort By (select). Shows active filter count + result count. Export DropdownButton on right.

3. **Table** — columns:
   - `#` (rank, 48px, bold `--text-tertiary`)
   - Account (multiline: name + industry, 200px)
   - Risk (`StatusWithLabel`, 110px)
   - Outstanding (amount + days overdue in `--error-text-primary`, 120px)
   - AI Priority (inline progress bar + score number in risk color, 130px)
   - Why Now (12px `--text-secondary`, flex: 1)
   - Action (primary Button size small, 140px)

   Row height: 64px. Selectable: true. Row actions (kebab): View Profile, Call Now, Send Email, Create Task, Mark Paid (destructive).

4. **Pagination** — show results, configurable page size.

---

### Tab 3: Account Profile

**Purpose:** Deep AI-powered profile for a single account. Pre-loaded to Epsilon Motors Group.

**Layout:** Vertical stack, 24px gutters + 16px gaps.

1. **Customer Header Card** — `Card` with title "Epsilon Motors Group". Body:
   - Row: description text + `StatusWithLabel` (red, "Critical Risk") + `StatusWithLabel` (orange, "Credit Limit Exceeded")
   - 5-column stat grid (border-top separator): Outstanding `$3.1M`, Credit Limit `$3.5M`, Days Past Due `52`, Avg Days to Pay `61`, Recovery Prob. `68%`. Values at 22px/600, colors: error red for first 3, warning for Recovery.

2. **AI Risk Analysis Card** — two-column layout:
   - Left (flex: 1): `--info-background-muted` tinted box with AI narrative paragraph (13px, 1.7 line-height). Below: primary Button "Executive Escalation" + secondary Button "Place Credit Hold".
   - Right (240px): Risk score label + `StatusWithLabel` (red, "Critical") + 4-bar breakdown (label + score + progress bar), colors `--error-text-primary` / `--warning-text-primary`.

3. **Open Invoices** — Card-style container (header bar: "Open Invoices (11)" 16px/600) + `Table`:
   - Invoice # (linked, `--brand-text-primary`, underline), Date, Amount, Days Late (`--error-text-primary`), Status (`StatusWithLabel`)
   - 5 rows shown, 280px height.

4. **Communication History** — Card-style container + timeline list. Each item: colored dot + type (13px/600) + date (right-aligned, `--text-tertiary`) + summary (12px `--text-secondary`) + outcome (12px/600, color by outcome).

---

### Tab 4: Outreach

**Purpose:** AI-drafted personalized outreach — compose and send communications.

**Layout:** 2-column grid (1fr 300px), 24px gutters.

**Left — Compose Card:**
- Title: "Compose Outreach — Epsilon Motors Group"
- AI Reasoning box: `--info-background-muted` fill, `--info-border-primary` border. Label "AI REASONING" (10px/700 uppercase `--info-text-primary`) + explanation paragraph.
- `TextArea` (label: "Email Body", rows: 12) pre-filled with executive escalation draft.
- `Footer` with primary CTA "Send Now" + secondary CTA "Schedule".

**Right — Context Column:**
- `Card` "Customer Context": key-value list (5 rows), values colored by severity.
- `Card` "AI Outcome Prediction": descriptive paragraph about similar account outcomes.

---

### Tab 5: Forecasting

**Purpose:** Forward-looking predictions — DSO trajectory, cash inflow, default risk.

**Layout:** Vertical stack, 24px gutters.

1. **NotificationBanner** (type: `warning`) — DSO alert.

2. **2-column Card grid:**
   - "Expected Cash Inflow — 4 Weeks": SVG bar chart, 4 bars (Week 1–4), bars in `--brand-background-primary` at varying opacities.
   - "DSO 90-Day Forecast": SVG line chart, two lines — no-action (red dashed) vs. AI-guided (green solid). Annotations: "54d no action" / "36d with AI".

3. **30-Day Recovery Forecast Card** — 3 stacked progress bars:
   - Likely to Pay: `$5.4M`, `--success-text-primary`, 68% width
   - At Risk: `$2.8M`, `--warning-text-primary`, 35% width
   - Likely to Default: `$0.9M`, `--error-text-primary`, 11% width

4. **Accounts Likely to Default Table** — Card-style container + `Table`:
   - Account (multiline: name + signal), Risk (`StatusWithLabel`), Default Probability (14px/600 `--error-text-primary`)
   - 3 rows.

---

### Tab 6: Disputes

**Purpose:** AI-categorized dispute management with resolution recommendations.

**Layout:** NotificationBanner → FilterBar → Table (full bleed).

1. **NotificationBanner** (type: `warning`) — summary of open disputes.

2. **FilterBar** — result count "6 Disputes".

3. **Table** — row height 64px. Columns:
   - Account / Issue (multiline, 220px)
   - Amount (90px)
   - Category (`StatusWithLabel`, 110px — colors: yellow/Pricing, green/Duplicate, red/Damage, green/Credit, blue/Payment, grey/Admin)
   - Age (90px, color by severity: `--error-text-primary` >45d, `--warning-text-primary` >14d, `--text-secondary` otherwise)
   - AI Recommendation (12px `--text-secondary`, flex: 1)
   - Status (`StatusWithLabel`, 100px)

   Row actions (kebab): Resolve, Escalate, Close (destructive).

---

## AI Copilot SideSheet

Opens from "AI Copilot" button in the AI Query Bar. Implemented as `SideSheet` (size: small = 451px, overlay: false, no bottom footer).

**Header:** "SmartCollect AI Copilot" + close button.

**Body (flex column, full height):**

1. **Message list** (flex: 1, overflow-y: auto, 16px padding, 14px gap):
   - User messages: right-aligned, `--background-active` fill, `--border-active` border, `--radius-xs`, 10px 14px padding, 13px text.
   - AI messages: left-aligned with 24px avatar (brand blue, white star icon). Message bubble: `--background-secondary` fill, `--border-primary` border, `--radius-xs`. Below message body: optional "Evidence" section (10px uppercase label in `--brand-text-primary`, 11px `--text-tertiary` content) + confidence score.

2. **Quick prompts strip** (8px 16px padding, `--border-primary` top): 3 secondary small Buttons — "Who to call first?", "Why did DSO increase?", "Predict recovery".

3. **Input row** (12px 16px padding, `--border-primary` top): `TextInput`-style field + primary Button "Send". Sends message, appends AI response after 700ms.

**AI response logic (4 branches by keyword):**
- "call" / "first" → prioritized call list with evidence
- "dso" → DSO increase explanation
- "recover" / "predict" / "forecast" → cash recovery forecast
- default → collection health score + top 3 actions

---

## Interactions & Behavior

| Trigger | Behavior |
|---|---|
| Click KPI card | Navigate to relevant tab (see Dashboard section) |
| Click worklist/queue row | Navigate to Account Profile tab |
| Click "View Epsilon Motors" (NotificationBanner CTA) | Navigate to Account Profile tab |
| Click "Executive Escalation" button | Navigate to Outreach tab |
| Toggle AI Copilot | Open/close SideSheet (no overlay, slides from right) |
| Quick prompt click | Appends user message + AI response to copilot thread |
| Send copilot message | Appends message, 700ms delay, then AI response |
| FilterBar reset | Clears filterRisk and filterSort state |
| KPI hover | `box-shadow: 0 0 0 2px var(--brand-background-primary)` ring |

---

## State

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `activeTab` | number | 0 | Current tab index (0–5) |
| `copilotOpen` | boolean | false | Copilot SideSheet visibility |
| `copilotInput` | string | `""` | Controlled input value |
| `msgs` | array | 3 seed messages | Copilot conversation thread |
| `filterRisk` | string\|null | null | Queue risk filter (`critical`\|`high`\|`medium`\|`low`) |
| `filterSort` | string\|null | null | Queue sort field |
| `queuePage` | number | 1 | Collection Queue current page |
| `pageSize` | number | 10 | Rows per page |

---

## Data

All data in the prototype is **static mock data** representing automotive dealer AR accounts. In production, replace with live API calls to the Tekion AR service.

**Accounts (7):**
| Name | Industry | Outstanding | DPD | Risk Score | Level |
|---|---|---|---|---|---|
| Epsilon Motors Group | Multi-Location Dealer | $3.1M | 52 | 94 | Critical |
| Gamma Industries | Parts Distributor | $1.82M | 38 | 87 | High |
| Alpha Motors Ltd | Franchise Dealer | $1.45M | 24 | 81 | High |
| Zeta Wheels Pvt | Wheel & Tire Supplier | $890K | 16 | 66 | Medium |
| Beta Supplies Co | OEM Parts Supplier | $620K | 9 | 58 | Medium |
| Delta Auto Parts | Auto Parts Wholesale | $380K | 6 | 26 | Low |
| Omega Fleet Services | Fleet Management | $290K | 3 | 15 | Low |

**AI risk score** is 0–100. Explainability factors: broken promises, credit utilization, payment velocity, dispute duration.

---

## Design Tokens Used

| Role | Token | Value |
|---|---|---|
| Primary action | `--brand-background-primary` | Tekion blue (denim) |
| Selected surface | `--background-active` | #DBEBFF |
| Page background | `--background-secondary` | near-white |
| Card background | `--background-primary` | white |
| Body text | `--text-primary` | near-black |
| Secondary text | `--text-secondary` | grey |
| Muted text | `--text-tertiary` | light grey |
| Error/overdue | `--error-text-primary` | red |
| Warning | `--warning-text-primary` | amber |
| Success | `--success-text-primary` | green |
| AI accent | `--brand-text-primary` | Tekion blue |
| Border | `--border-primary` | 1px platinum |
| Corner radius | `--radius-xs` | 2px |

---

## Assets

- No external images used. All icons via Phosphor Icons (loaded by ARC bundle).
- AI sparkle/star icon: Phosphor `star` or custom `AiIcon` component.
- Empty states: use `EmptySection` component from ARC.

---

## Files in This Package

| File | Purpose |
|---|---|
| `SmartCollect AI v2.dc.html` | Full interactive HTML prototype — primary design reference |
| `SmartCollect AI - Design Prompt.md` | Original product brief with full feature spec, AI engine logic, and UX rules |
| `README.md` | This document |

---

## Notes for Implementation

1. **Module entry point:** Add "AR Insights" as a module in the Accounting app's module registry. Route: `/accounting/ar-insights`.
2. **Tab routing:** Each tab should be a named route so deep-linking and browser back/forward work correctly.
3. **AI Copilot:** In production, wire the copilot input to the Tekion AI service (or Claude API via `window.claude.complete`). The mock response branches in the prototype show the expected response schema.
4. **Risk scores:** The risk engine spec is in `SmartCollect AI - Design Prompt.md` → `<ai_risk_engine>` section. Backend must return: score (0–100), level (critical/high/medium/low), and top 3 contributing factors as plain-language strings.
5. **Table columns:** The prototype uses `React.createElement` inside column `render` functions for inline `StatusWithLabel` and `Button` components — this is the correct pattern for the ARC `Table` component's column spec API.
6. **Copilot SideSheet:** Use `overlay: false` so the main content area remains interactive while the panel is open. The panel should not push content — it overlays the right edge.
