# QuickInvoice — Requirements Clarification Questions

You've provided a strong foundation. Please answer the questions below by filling in the letter choice after each `[Answer]:` tag. If none of the options fit, choose the last option (Other) and describe your preference.

---

## SECTION A: Functional Requirements

## Question 1
For **user authentication**, what account lifecycle features are needed at MVP?

A) Sign up + login + logout only (minimal)

B) Sign up + login + logout + email verification

C) Sign up + login + logout + email verification + password reset

D) Sign up + login + logout + email verification + password reset + Google/GitHub OAuth

E) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 2
For **client management**, which fields are required on a client record?

A) Name and email only

B) Name, email, phone, company name

C) Name, email, phone, company name, billing address

D) Name, email, phone, company name, billing address, plus custom notes field

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3
For **invoice line items**, what level of detail is needed?

A) Description + quantity + unit price (auto-calculated total)

B) Description + quantity + unit price + tax rate per line

C) Description + quantity + unit price + discount + tax rate per line

D) Description + quantity + unit price + tax rate + currency selection per invoice

E) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 4
Should invoices support **recurring / repeat billing**?

A) No — one-off invoices only for MVP

B) Yes — allow marking an invoice as recurring (monthly/weekly) but manual re-send

C) Yes — fully automated recurring invoice generation and sending

D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 5
How should **invoices be delivered to clients**?

A) Generate a shareable public link only (no email sending)

B) Send via email from the platform (platform sends on behalf of user)

C) Both — shareable link AND platform email sending

D) Generate a PDF download only (user sends it themselves)

E) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 6
Is **payment collection** (online payment processing) in scope for MVP?

A) No — track payment status manually (freelancer marks invoice as paid)

B) Yes — integrate Stripe so clients can pay online via the invoice link

C) Yes — integrate a payment gateway but let the user choose (Stripe, PayPal, etc.)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 7
What should the **dashboard** display beyond outstanding amounts?

A) Outstanding total + list of unpaid invoices only

B) Outstanding total + overdue invoices + recent activity (last 5 invoices)

C) Outstanding total + overdue + revenue this month + revenue this year + recent activity

D) Full analytics: revenue trends, top clients, average payment time, conversion metrics

E) Other (please describe after [Answer]: tag below)

[Answer]: D

---

## Question 8
Is **invoice numbering** automatic or user-defined?

A) Auto-increment (INV-001, INV-002…) — user cannot change

B) Auto-increment with a user-configurable prefix (e.g. ACME-001)

C) Fully manual — user types the invoice number each time

D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## SECTION B: Non-Functional Requirements

## Question 9
What are the **performance expectations** for the MVP?

A) Best-effort — acceptable for a personal side project (no SLA)

B) Invoice page loads in < 2s, API responses < 500ms under normal load

C) Strict: < 1s load times, < 200ms API responses, 99.9% uptime target

D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 10
What is the **expected user scale** at MVP launch?

A) Solo / personal use (1–5 users)

B) Small beta (< 100 users)

C) Early public launch (100–1,000 users)

D) Growth-ready from day one (1,000–10,000 users)

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 11
What is the **data residency / compliance** requirement?

A) None — no specific compliance needed for MVP

B) GDPR compliance required (EU users in scope)

C) SOC 2 Type II or ISO 27001 alignment needed

D) PCI-DSS required (if taking card payments directly)

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## SECTION C: Technical Architecture

## Question 12
For the **serverless backend**, which cloud provider should be used?

A) AWS (Lambda + API Gateway + DynamoDB/RDS)

B) AWS with AWS Amplify for rapid setup

C) Vercel (serverless functions) + PlanetScale or Supabase

D) Cloudflare Workers + D1 or Cloudflare KV

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 13
What **database** should back the application?

A) DynamoDB (NoSQL — fits serverless, scales automatically)

B) PostgreSQL via RDS or Aurora Serverless (relational, strong for financial data)

C) Supabase (managed Postgres with built-in auth)

D) PlanetScale (serverless MySQL)

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 14
For the **frontend**, what framework/approach?

A) Plain HTML/CSS/JS (as suggested in workspace steering — no build step)

B) React (Create React App or Vite)

C) Next.js (React + SSR, deploys to Vercel/AWS)

D) Vue.js or Svelte

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 15
How should **authentication** be implemented technically?

A) Roll custom JWT auth in Node.js/TypeScript

B) AWS Cognito (managed auth, integrates with API Gateway)

C) Auth0 or Clerk (third-party managed auth)

D) Supabase Auth (if Supabase chosen for DB)

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## SECTION D: Business & UX

## Question 16
What **subscription / billing model** should MVP implement?

A) No billing in MVP — free while building, add billing later

B) Simple Stripe subscription: single $9/month plan + 30-day free trial

C) Freemium: free tier (limited invoices) + $9/month paid tier

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 17
Should the platform support **multiple currencies**?

A) Single currency only (user's default, e.g. USD)

B) User sets a default currency per account but invoices always use that currency

C) Per-invoice currency selection from a predefined list

D) Full multi-currency with live exchange rates

E) Other (please describe after [Answer]: tag below)

[Answer]: A (AUD)

---

## Question 18
What **branding/customization** can freelancers apply to invoices?

A) None — fixed platform template for MVP

B) Upload a logo only

C) Upload logo + choose accent color

D) Full custom branding: logo, colors, font, footer text

E) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## SECTION E: Extensions

## Question 19
**Security Extension**
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 20
**Resiliency Extension**
Should the resiliency baseline be applied to this project?

Enabling it applies directional, design-time best practices for building resilient systems (fault tolerance, high availability, observability, recoverability) derived from the AWS Well-Architected Framework. It is a starting point, not a substitute for a formal AWS Well-Architected Review.

A) Yes — apply the resiliency baseline as directional best practices (recommended for business-critical workloads)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 21
**Property-Based Testing Extension**
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, or financial calculations)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips

C) No — skip all PBT rules (suitable for simple CRUD applications or thin integration layers)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

*Please fill in all [Answer]: tags above, then let me know when you're done.*
