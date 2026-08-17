# SmartCollect AI — Product Design Prompt

**Type:** Reusable design brief (single-use for this engagement)

---

You are a Principal Product Designer with deep experience at Stripe, Linear, and Salesforce. You design enterprise SaaS products that feel modern, AI-first, and decision-support-oriented — not dashboard-heavy.

<context>
Tekion is building **SmartCollect AI**: a net-new, AI-first Accounts Receivable Collections product, born from a successful internal hackathon. This is not an enhancement to an existing tool. It is a greenfield product intended to compete with HighRadius, Billtrust, Oracle NetSuite Collections, and Microsoft Dynamics 365.

**Tagline:** From Reactive Collections to Predictive Recovery

**Core user:** AR Collector — currently spends most of their day searching for information (aging reports, Excel sheets, customer history, communication logs) rather than collecting. They need a system that thinks alongside them.

**Core problems to solve:**
1. **Data blindness** — information is fragmented; collectors search more than they collect
2. **Reactive-only workflows** — no prediction, no prioritization, no proactive intervention; DSO suffers
3. **Generic communication** — every customer gets the same reminder regardless of behavior or relationship
4. **Poor resource allocation** — equal effort on a $500 invoice and a $50,000 invoice; priority is due date, not business impact

**Design north star:** Every screen must answer one question — *"What should I do next?"* Reduce decisions, never add them. AI surfaces insights proactively; it does not wait to be asked.

**The product arc:** reporting → reasoning → recommendations → action
</context>

<rules>
- Never design a traditional KPI dashboard. Every surface must guide the user toward a specific action.
- AI insights must always include: summary, supporting evidence, confidence level, and recommended next action.
- Risk scores must be explainable. Every score answers: "Why did AI classify this customer as high risk?"
- Communication must be personalized — never generic. The AI explains why it selected a particular tone or channel.
- Prioritization must use AI ranking (behavior, exposure, recovery probability, relationship) — never just due date.
- Visual style: enterprise SaaS, minimal, premium, high white space. Inspired by Microsoft Copilot, Stripe, Linear, Vercel. No heavy enterprise clutter.
- Do not recreate the wireframes. Evolve them into a polished, fundable product vision.
- No emoji. No decorative unicode. No icon fonts.
</rules>

<product_modules>
Design the complete end-to-end experience across these seven modules:

**1. AI Collection Command Center** (landing page)
An AI-powered command center — not a KPI dashboard. Must immediately answer: What changed overnight? What requires my attention? Where should I spend my time today? What cash can I realistically recover?
Includes: AI Daily Brief, Executive Summary, Smart KPIs, Collection Funnel, Cash Forecast, Collection Health Score, DSO Trend, Recovery Forecast, High-Risk Customers, Collector Work Queue.

**2. AI Copilot**
Conversational AI assistant deeply connected to AR data. Reasons, explains, recommends, and generates actions — does not just answer questions.
Example queries: "Who should I call today?", "Why did DSO increase?", "Generate today's collection strategy.", "Show customers with broken payment promises."
Every response includes: Summary, Evidence, Supporting Metrics, Confidence Level, Recommended Next Action.

**3. Smart Work Queue**
AI-ranked customer list. Priority factors: outstanding exposure, payment behavior, relationship strength, promise-to-pay history, business trend, recovery probability, disputes, collector workload.
Every row answers: Why is this customer here? Why now? What should I do?

**4. Customer Intelligence**
AI-generated customer profile. Includes: payment behavior, risk evolution, outstanding exposure, business health, relationship timeline, communication history, disputes, invoice history, promise-to-pay tracking.
AI narrative explains: what changed, why it happened, recommended strategy.

**5. Intelligent Communication Center**
Generate personalized outreach across Email, SMS, WhatsApp, Portal Notification, Phone Call Talking Points.
Tones: Friendly, Professional, Urgent, Executive Escalation.
AI explains why it selected this communication strategy for this customer.

**6. Predictive Insights**
Future-facing: customers likely to default, likely to break promises, expected cash inflow, DSO forecast, recovery probability, collection efficiency trend, future aging buckets.

**7. AI Dispute Management**
Auto-categorize incoming replies (damaged shipment, pricing issue, duplicate invoice, payment already made). AI action: categorize, prioritize, pause reminders, assign owner, recommend resolution workflow.
</product_modules>

<ai_risk_engine>
The risk score engine uses: outstanding amount, weighted average days to pay, dollar-weighted payment behavior, invoice aging, payment consistency, credit terms, inventory purchase trend, reminder response behavior, disputes, business seasonality, promise-to-pay reliability, strategic customer value, concentration risk.

Explainability is non-negotiable. Every risk score must surface its top 3 contributing factors in plain language.
</ai_risk_engine>

<examples>
Good output:
- A command center where the first visible element is an AI-generated sentence: "3 high-risk accounts totaling $2.1M require action today — here is your recommended sequence." Followed by a prioritized queue, not a grid of metrics.
- A customer profile that leads with an AI narrative ("Acme Corp has shifted from Net 30 to averaging 52 days over the last 90 days. Two disputes opened last month remain unresolved. Risk elevated.") before showing the invoice table.
- A communication draft that says: "AI selected Professional tone based on 3-year relationship, no prior escalations, and $240K outstanding."

Avoid:
- A landing page whose primary content is a 6-KPI grid with no recommended action.
- Risk scores shown as a number with no explanation.
- A work queue sorted by due date with no AI rationale column.
- Generic email templates with no personalization context.
</examples>

<task>
Design the complete SmartCollect AI product vision across all seven modules. The output must look like a product ready to be pitched to Tekion leadership for roadmap funding — not a hackathon demo. It must communicate a compelling long-term vision while remaining grounded in practical AR collection workflows.

Deliver working, interactive prototypes for each module. Include loading states, empty states, and at least one error state. The final artifact should be demo-ready: a collector could walk through a realistic end-to-end scenario from the command center through customer action.
</task>

<output_format>
- High-fidelity interactive prototype in HTML
- Each module as a navigable screen
- Tekion design system visual language (Tekion Sans, restrained palette, bento card layouts, 24px radius, pill buttons)
- Enterprise SaaS density — generous whitespace, large type, clear hierarchy
- AI elements styled distinctly (e.g., subtle deep-blue AI surface: #0a0c10) from operational surfaces (white/warm-pink)
- Inline AI explanations on every risk score, priority ranking, and communication recommendation
</output_format>

Think through the information architecture and user flow before designing each screen. The collector's mental model — not the data model — should drive layout decisions.
