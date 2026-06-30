# QuickInvoice — Requirements Document

## Intent Analysis Summary

| Attribute | Value |
|---|---|
| **User Request** | Build QuickInvoice — an invoice management platform for freelancers |
| **Request Type** | New Project (Greenfield SaaS) |
| **Scope** | System-wide — auth, client management, invoicing, payment tracking, dashboard, PDF generation |
| **Complexity** | Comprehensive — financial data, multi-user SaaS, serverless AWS architecture |
| **Depth Level** | Comprehensive |

---

## Business Context

### The Pitch
Create professional invoices in seconds, track payments, get paid faster.

### Hypothesis
Freelancers will pay $9/month for an invoice tool that reduces creation time from 15 minutes to 2 minutes.

### Success Metrics
- 30% trial-to-paid conversion rate
- Average invoice creation time under 3 minutes

### Subscription Model
- No billing in MVP — free during build phase, billing added post-MVP

---

## Functional Requirements

### FR-01: User Authentication

**FR-01.1** Users can register with email and password.  
**FR-01.2** Users can log in with email and password.  
**FR-01.3** Users can log out.  
**FR-01.4** Email verification is required before account activation.  
**FR-01.5** Users can request a password reset via email.  
**FR-01.6** Authentication is implemented using custom JWT in Node.js/TypeScript.  
**FR-01.7** JWT tokens must be short-lived (access token) with refresh token rotation.  
**FR-01.8** All authenticated routes must validate the JWT on every request.

### FR-02: Client Management

**FR-02.1** Authenticated users can create a client with name and email.  
**FR-02.2** Authenticated users can view a list of all their clients.  
**FR-02.3** Authenticated users can view a single client's details.  
**FR-02.4** Authenticated users can update a client's name and email.  
**FR-02.5** Authenticated users can delete a client (soft delete — invoices referencing the client are retained).  
**FR-02.6** Clients are scoped to the owning user — no cross-user visibility.

### FR-03: Invoice Creation

**FR-03.1** Authenticated users can create an invoice associated with a client.  
**FR-03.2** An invoice contains:
  - Invoice number (auto-incremented with user-configurable prefix, e.g. `ACME-001`)
  - Client reference
  - Issue date
  - Due date
  - One or more line items (each: description, quantity, unit price, tax rate %)
  - Subtotal (sum of quantity × unit price across all line items)
  - Tax total (sum of each line item's tax amount)
  - Grand total (subtotal + tax total)
  - Currency: AUD (fixed — single currency platform)
  - Notes / terms (optional free text)

**FR-03.3** Invoice number prefix is configurable in user account settings (default: `INV`).  
**FR-03.4** Invoice numbers auto-increment per user, never reusing a number even after deletion.  
**FR-03.5** Users can add, edit, and remove line items before saving.  
**FR-03.6** Totals are calculated server-side on save for integrity; client-side preview is acceptable.  
**FR-03.7** Invoices are one-off only — no recurring billing in MVP.

### FR-04: Invoice Management

**FR-04.1** Users can view a list of all their invoices with status indicators.  
**FR-04.2** Users can view a single invoice in full detail.  
**FR-04.3** Users can edit a draft invoice.  
**FR-04.4** Users can delete a draft invoice.  
**FR-04.5** Sent, viewed, and paid invoices cannot be edited (immutable once sent).  
**FR-04.6** Users can duplicate an existing invoice as a new draft.

### FR-05: Invoice Delivery — PDF Download

**FR-05.1** Users can generate and download a PDF of any invoice.  
**FR-05.2** The PDF uses a fixed platform template (no custom branding in MVP).  
**FR-05.3** The PDF includes all invoice fields, line items, totals, and footer with payment instructions placeholder.  
**FR-05.4** PDF generation is performed server-side.

### FR-06: Payment Status Tracking

**FR-06.1** Each invoice has one of four statuses: `draft`, `sent`, `viewed`, `paid`.  
**FR-06.2** Status transitions are:
  - `draft` → `sent` (user action: mark as sent after downloading/emailing PDF manually)
  - `sent` → `viewed` (future: via public link tracking — placeholder for post-MVP)
  - `sent` or `viewed` → `paid` (user action: mark as paid manually)
  - Any status → `draft` is NOT allowed once sent

**FR-06.3** Users can manually mark an invoice as `sent`.  
**FR-06.4** Users can manually mark an invoice as `paid`.  
**FR-06.5** Each status change is timestamped and stored.

### FR-07: Dashboard & Analytics

**FR-07.1** The dashboard displays:
  - Total outstanding amount (sum of all `sent` + `viewed` invoice totals)
  - Total overdue amount (outstanding invoices past due date)
  - Revenue this month (sum of `paid` invoices with paid date in current calendar month)
  - Revenue this year (sum of `paid` invoices with paid date in current calendar year)
  - Recent activity: last 10 invoices with status, client name, amount, and date
  - Top clients by revenue (top 5 by total paid amount, all time)
  - Average payment time (average days between `sent` and `paid` for completed invoices)

**FR-07.2** Dashboard data is computed server-side on each load (no real-time streaming in MVP).  
**FR-07.3** Dashboard is accessible immediately after login.

---

## Non-Functional Requirements

### NFR-01: Performance

**NFR-01.1** Invoice page (view/edit) must load in under 2 seconds under normal load.  
**NFR-01.2** API responses must return within 500ms under normal load (p95).  
**NFR-01.3** PDF generation must complete within 5 seconds.  
**NFR-01.4** Dashboard aggregate queries must complete within 1 second.

### NFR-02: Scale

**NFR-02.1** MVP targets 1–5 concurrent users (personal/beta use).  
**NFR-02.2** Architecture must not prevent scaling to 1,000+ users with configuration changes (serverless by design).

### NFR-03: Security

**NFR-03.1** All API endpoints must be served over HTTPS only.  
**NFR-03.2** JWT access tokens must expire within 15 minutes; refresh tokens within 7 days.  
**NFR-03.3** Passwords must be hashed with bcrypt (cost factor ≥ 12).  
**NFR-03.4** All user data must be strictly scoped — users must not be able to access another user's clients, invoices, or data.  
**NFR-03.5** All API inputs must be validated and sanitised before processing or persistence.  
**NFR-03.6** Sensitive configuration (DB connection strings, JWT secrets, email credentials) must be stored in environment variables / AWS Secrets Manager — never in source code.  
**NFR-03.7** Security extension rules (SECURITY baseline) are **enabled** and enforced as blocking constraints.

### NFR-04: Reliability

**NFR-04.1** Resiliency baseline (AWS Well-Architected, Reliability Pillar) is **enabled** as directional best-practice guidance.  
**NFR-04.2** All write operations (create/update invoice, create client) must be idempotent where possible.  
**NFR-04.3** The system must handle Lambda cold starts gracefully (no user-visible errors from cold start alone).  
**NFR-04.4** DynamoDB requests must include appropriate error handling and retry logic.

### NFR-05: Compliance

**NFR-05.1** No specific compliance framework (GDPR, SOC2, PCI-DSS) required for MVP.  
**NFR-05.2** No payment card data is stored or processed — payment tracking is manual status updates only.

### NFR-06: Testability

**NFR-06.1** Property-based testing (PBT) rules are **enabled** as blocking constraints.  
**NFR-06.2** All financial calculation functions (subtotal, tax, grand total) must have property-based tests.  
**NFR-06.3** All data transformation and serialization logic must have property-based tests.  
**NFR-06.4** Unit tests required for all business logic; integration tests for all API endpoints.

### NFR-07: Maintainability

**NFR-07.1** TypeScript strict mode (`"strict": true`) must be enabled.  
**NFR-07.2** All public functions and API handlers must be documented with JSDoc.  
**NFR-07.3** Project must include a `README.md` with local dev setup instructions.

### NFR-08: Accessibility

**NFR-08.1** All HTML pages must meet WCAG 2.1 Level AA requirements.  
**NFR-08.2** Forms must have associated labels, error messages, and keyboard navigation.  
**NFR-08.3** Colour contrast ratios must meet minimum AA thresholds.

---

## Technical Architecture Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Cloud Provider | AWS | Serverless Lambda + API Gateway + DynamoDB |
| Backend Runtime | Node.js (TypeScript) | User specified |
| Backend Framework | AWS Lambda handlers (serverless) | User specified |
| Database | DynamoDB (NoSQL) | Serverless-native, scales automatically, no connection pool issues |
| Authentication | Custom JWT (Node.js/TypeScript) | User specified; bcrypt for passwords |
| Frontend | Plain HTML5 / CSS3 / Vanilla JS | User confirmed despite complexity tradeoff |
| PDF Generation | Server-side (Lambda) | Puppeteer or PDFKit running in Lambda |
| Deployment | AWS SAM or Serverless Framework | Infrastructure-as-code for Lambda + API Gateway |
| Currency | AUD only | Single currency platform for MVP |
| Invoice Numbering | Auto-increment with configurable prefix | e.g. `INV-001`, `ACME-042` |

---

## Extension Configuration

| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | **Yes** | Requirements Analysis |
| Resiliency Baseline | **Yes** | Requirements Analysis |
| Property-Based Testing | **Yes** | Requirements Analysis |

---

## Out of Scope (MVP)

- Subscription billing / Stripe integration (post-MVP)
- Email sending from platform (PDF download only — user sends manually)
- Recurring / automated invoices
- Custom invoice branding (fixed template)
- Public invoice link / client-facing portal
- Multi-currency support
- OAuth (Google / GitHub)
- Mobile app
- Real-time notifications

---

## Key Constraints

- **Timeline**: 2-hour MVP target — scope ruthlessly to core flows
- **Solo user at launch**: No multi-tenancy complexity beyond basic user scoping
- **No billing at launch**: Authentication and core invoice flows are the critical path

---

## Addendum: Design Review Findings (secret-protection-best-practices)

The following requirements were added from the AWS Security Agent Design Review:

### NFR-03 (Updated): Secret Protection

**NFR-03.8** JWT signing MUST use **RS256** (asymmetric RSA) rather than HS256 (symmetric HMAC):
- Private key used for signing (held only by AuthLambda)
- Public key used for verification (distributed to JWTAuthorizerLambda and any future services)
- Enables key rotation without coordinated redeployment of all verifying services

**NFR-03.9** A **rotation policy** MUST be defined for the JWT private key:
- Automated rotation via AWS Secrets Manager rotation Lambda on a defined schedule (default: 90-day rotation)
- Rotation Lambda generates new RSA key pair, stores new private key, publishes new public key to a well-known endpoint or Parameter Store
- JWTAuthorizerLambda fetches the public key on each cold-start and re-fetches when signature verification fails (supports zero-downtime rotation)

**NFR-03.10** A **credential compromise response procedure** MUST be documented covering:
- Trigger conditions (suspected key leak, anomalous token use)
- Immediate response: rotate JWT private key immediately via emergency rotation Lambda invocation
- Mass token revocation: increment a global `tokenVersion` counter in DynamoDB; all issued JWTs include this version; JWTAuthorizer rejects tokens with a stale version
- User notification process
- Post-incident review steps
