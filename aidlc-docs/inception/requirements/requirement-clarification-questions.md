# QuickInvoice — Clarification Questions

I detected **3 contradictions** in your responses that need resolving before I can generate the requirements document.

---

## Contradiction 1: Recurring Invoices vs. Delivery Method

You indicated **fully automated recurring invoice generation and sending** (Q4: C) but also **PDF download only — user sends it themselves** (Q5: D).

These conflict: automated recurring billing requires the platform to automatically send invoices to clients on a schedule. If delivery is PDF-only with no platform sending, automation isn't possible.

### Clarification Question 1
How should recurring invoices work for QuickInvoice?

A) Drop recurring invoices entirely — one-off invoices only (PDF download, user sends themselves)

B) Keep recurring but make it reminder-only — platform reminds the freelancer to send, freelancer downloads PDF and sends manually

C) Keep fully automated recurring — platform sends invoices by email on schedule (this requires platform email sending, overriding Q5 to include email delivery)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Contradiction 2: Currency Selection Per Invoice vs. Single Currency (AUD)

You selected **per-invoice currency selection from a predefined list** (Q3: D — which includes currency per invoice) but also **single currency only, AUD** (Q17: A).

These directly conflict. Q3-D bundles currency selection into line items; Q17-A says only AUD is used.

### Clarification Question 2
Which currency approach is correct for QuickInvoice?

A) Single currency only (AUD) — simplify Q3 to option A: Description + quantity + unit price + tax rate. No per-invoice currency selection.

B) Per-invoice currency selection — override Q17. User can choose currency per invoice from a list (AUD, USD, EUR, GBP, etc.)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Contradiction 3: Vanilla HTML/JS Frontend vs. Feature Complexity

You chose **Plain HTML/CSS/JS** (Q14: A) but also selected:
- Full analytics dashboard with revenue trends, top clients, avg payment times (Q7: D)
- Fully automated recurring invoices (Q4: C — pending Clarification 1)
- Per-invoice currency selection (Q3: D — pending Clarification 2)

Plain HTML/JS is viable for simple CRUD but becomes very hard to maintain for a dashboard with charts, real-time data, and complex state. The workspace `tech.md` steering also recommends it for simple static sites — QuickInvoice is more complex.

### Clarification Question 3
Which frontend approach should be used given the feature complexity?

A) Keep Plain HTML/CSS/JS — accept the complexity tradeoff, build without a framework

B) Use React (Vite) — modern component-based, good for dashboards and complex state, still TypeScript-compatible

C) Use Next.js — React + SSR, easiest AWS deployment, built-in routing, TypeScript first-class

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

*Please fill in all [Answer]: tags above, then let me know when you're done.*
