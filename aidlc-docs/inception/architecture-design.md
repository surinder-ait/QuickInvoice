# QuickInvoice — Architecture Design

> **Version**: 1.0  
> **Date**: 2026-06-30  
> **Status**: Draft — derived from Requirements v1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Components and Responsibilities](#2-system-components-and-responsibilities)
3. [Data Flow Between Components](#3-data-flow-between-components)
4. [Authentication and Authorization Approach](#4-authentication-and-authorization-approach)
5. [Data Storage and Encryption Strategy](#5-data-storage-and-encryption-strategy)
6. [External Integrations](#6-external-integrations)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Key Architectural Decisions and Trade-offs](#8-key-architectural-decisions-and-trade-offs)

---

## 1. System Overview

QuickInvoice is a serverless SaaS application hosted on AWS. The system separates into three distinct layers:

- **Frontend** — static HTML/CSS/JS pages served from S3 + CloudFront
- **API Layer** — stateless Lambda functions exposed through API Gateway
- **Data Layer** — DynamoDB for application data, AWS Secrets Manager for secrets, SES for transactional email

```
+------------------+        HTTPS         +----------------------+
|                  | -------------------> |                      |
|   Browser        |                      |   CloudFront + S3    |
|   (HTML/CSS/JS)  | <------------------- |   (Static Frontend)  |
|                  |        HTTPS         |                      |
+--------+---------+                      +----------------------+
         |
         | HTTPS (REST API calls)
         v
+------------------+        Invoke        +----------------------+
|                  | -------------------> |                      |
|   API Gateway    |                      |   Lambda Functions   |
|   (REST API)     | <------------------- |   (Node.js/TS)       |
|                  |        Response      |                      |
+------------------+                      +----------+-----------+
                                                     |
                      +------------------------------+------------------------------+
                      |                              |                             |
                      v                              v                             v
           +----------+----------+      +-----------+-----------+    +------------+----------+
           |                     |      |                       |    |                       |
           |   DynamoDB          |      |   AWS SES             |    |   AWS Secrets Manager |
           |   (Application DB)  |      |   (Email: verify,     |    |   (JWT secret,        |
           |                     |      |    password reset)    |    |    SES credentials)   |
           +---------------------+      +-----------------------+    +-----------------------+
```

---

## 2. System Components and Responsibilities

### 2.1 Frontend — Static Web Application

| Attribute | Detail |
|---|---|
| **Technology** | Plain HTML5, CSS3, Vanilla JavaScript |
| **Hosting** | AWS S3 (static website) + CloudFront CDN |
| **Build** | No build step — files served as-is |

**Responsibilities:**
- Render all UI pages: login, register, dashboard, clients, invoices, invoice editor
- Manage client-side session state (store access token in memory; refresh token in `HttpOnly` cookie)
- Make authenticated REST API calls to API Gateway using `Authorization: Bearer <access_token>`
- Perform client-side invoice total preview (subtotal, tax, grand total) for instant feedback — server recalculates on save for integrity
- Trigger PDF download by calling the PDF generation endpoint and receiving a binary response
- Handle token refresh transparently via silent background calls before token expiry

**Pages / Routes:**
```
/                    -> redirect to /dashboard or /login
/login               -> login form
/register            -> registration form
/verify-email        -> email verification landing
/reset-password      -> password reset form
/dashboard           -> analytics dashboard
/clients             -> client list
/clients/new         -> create client form
/clients/:id         -> edit client form
/invoices            -> invoice list
/invoices/new        -> invoice editor (create)
/invoices/:id        -> invoice editor (edit draft) or invoice detail (sent/paid)
```

---

### 2.2 API Gateway — REST API Entry Point

| Attribute | Detail |
|---|---|
| **Service** | AWS API Gateway (REST API) |
| **Protocol** | HTTPS only |
| **Auth** | JWT Authorizer (Lambda Authorizer) on all protected routes |

**Responsibilities:**
- Expose all API routes as HTTPS endpoints
- Route requests to the appropriate Lambda function
- Execute the JWT Lambda Authorizer on every protected request before forwarding
- Enforce CORS policy (allow only CloudFront origin)
- Rate limiting via Usage Plans (post-MVP hardening)

**Route Groups:**
```
POST   /auth/register          -> AuthLambda
POST   /auth/login             -> AuthLambda
POST   /auth/logout            -> AuthLambda
POST   /auth/refresh           -> AuthLambda
GET    /auth/verify-email      -> AuthLambda
POST   /auth/forgot-password   -> AuthLambda
POST   /auth/reset-password    -> AuthLambda

GET    /clients                -> ClientsLambda  [protected]
POST   /clients                -> ClientsLambda  [protected]
GET    /clients/:id            -> ClientsLambda  [protected]
PUT    /clients/:id            -> ClientsLambda  [protected]
DELETE /clients/:id            -> ClientsLambda  [protected]

GET    /invoices               -> InvoicesLambda [protected]
POST   /invoices               -> InvoicesLambda [protected]
GET    /invoices/:id           -> InvoicesLambda [protected]
PUT    /invoices/:id           -> InvoicesLambda [protected]
DELETE /invoices/:id           -> InvoicesLambda [protected]
POST   /invoices/:id/duplicate -> InvoicesLambda [protected]
PATCH  /invoices/:id/status    -> InvoicesLambda [protected]
GET    /invoices/:id/pdf       -> PDFLambda      [protected]

GET    /dashboard              -> DashboardLambda [protected]

GET    /users/me               -> UsersLambda    [protected]
PUT    /users/me               -> UsersLambda    [protected]
```

---

### 2.3 Lambda Functions — Business Logic Layer

All Lambda functions are written in TypeScript, compiled to Node.js 20.x, and deployed independently.

#### AuthLambda

**Responsibilities:**
- Register new user: validate input, check email uniqueness, hash password (bcrypt ≥ 12), store user record, send verification email via SES
- Login: validate credentials, check email verification status, issue access token (JWT, 15 min) + refresh token (JWT, 7 days), store refresh token hash in DynamoDB
- Logout: invalidate refresh token (delete from DynamoDB)
- Refresh: validate refresh token, rotate to new access + refresh token pair
- Email verification: validate token, mark user as verified
- Password reset: validate reset token, hash new password, update user record, invalidate all existing refresh tokens

#### JWTAuthorizerLambda

**Responsibilities:**
- Invoked by API Gateway before every protected request
- Verify JWT signature using secret from Secrets Manager
- Verify token expiry, issuer, and audience claims
- Extract `userId` from token claims
- Return IAM `Allow` policy with `userId` injected into request context
- Return IAM `Deny` policy on any validation failure — request never reaches business logic Lambda

#### ClientsLambda

**Responsibilities:**
- CRUD operations on client records
- Enforce user scoping: all queries include `userId` from authorizer context — never from request body
- Soft delete: set `deletedAt` timestamp, exclude from list queries
- Validate all inputs (name required, email format valid)

#### InvoicesLambda

**Responsibilities:**
- CRUD operations on invoice records
- Enforce user scoping via authorizer context
- Generate invoice number on create: read user's `invoiceCounter` (atomic increment via DynamoDB conditional write), format as `<prefix>-<padded-number>`
- Recalculate and store subtotal, tax total, grand total server-side on every create/update
- Enforce status transition rules (reject invalid transitions)
- Record `statusChangedAt` timestamp on every status change
- Duplicate invoice: copy all fields to new draft, assign new invoice number

#### PDFLambda

**Responsibilities:**
- Accept `invoiceId` from authenticated request
- Fetch invoice + client data from DynamoDB
- Render PDF using PDFKit (chosen over Puppeteer to avoid Chromium binary size in Lambda)
- Return PDF as binary response with `Content-Type: application/pdf` and `Content-Disposition: attachment`
- Never store generated PDFs — generated on-demand each request

#### DashboardLambda

**Responsibilities:**
- Fetch all invoices for the authenticated user from DynamoDB
- Compute in-Lambda aggregations:
  - Outstanding total (sum of `sent` + `viewed` invoice grand totals)
  - Overdue total (outstanding invoices where `dueDate` < today)
  - Revenue this month (sum of `paid` invoices where `paidAt` in current calendar month)
  - Revenue this year (sum of `paid` invoices where `paidAt` in current calendar year)
  - Recent activity (last 10 invoices sorted by `updatedAt` descending)
  - Top 5 clients by total paid revenue (all time)
  - Average payment time in days (mean of `paidAt` - `sentAt` for all paid invoices)
- Return computed summary as JSON

#### UsersLambda

**Responsibilities:**
- Get current user profile (`GET /users/me`)
- Update user settings: invoice prefix, display name
- Validate prefix format (alphanumeric, 1–10 chars)

---

### 2.4 DynamoDB — Application Database

Single-table design with composite keys. See [Section 5](#5-data-storage-and-encryption-strategy) for full schema.

**Responsibilities:**
- Persist all application data: users, refresh tokens, clients, invoices
- Provide atomic counter increments for invoice numbering (conditional writes)
- Enforce item-level isolation via partition key design (all items include `userId` in PK)

---

### 2.5 AWS SES — Transactional Email

**Responsibilities:**
- Send email verification links on registration
- Send password reset links on request
- Sender domain must be verified in SES
- In MVP, SES operates in sandbox mode (only verified recipient addresses)

---

### 2.6 AWS Secrets Manager — Secrets Store

**Responsibilities:**
- Store JWT signing secret (HS256 symmetric key, minimum 256-bit entropy)
- Store any third-party API keys added post-MVP
- Lambda functions retrieve secrets at cold-start and cache for the Lambda instance lifetime
- Secrets are never passed as environment variables in plaintext

---

### 2.7 AWS CloudFront + S3 — Frontend Delivery

**Responsibilities:**
- S3: store and serve static HTML, CSS, JS assets
- CloudFront: CDN distribution, HTTPS termination, cache static assets, enforce HTTPS-only (redirect HTTP → HTTPS)
- Origin Access Control (OAC) ensures S3 bucket is not publicly accessible directly — only via CloudFront

---

## 3. Data Flow Between Components

### 3.1 User Registration Flow

```
Browser                  API Gateway          AuthLambda              DynamoDB          SES
   |                          |                    |                      |               |
   |-- POST /auth/register -->|                    |                      |               |
   |                          |-- Invoke Lambda -->|                      |               |
   |                          |                    |-- Validate input     |               |
   |                          |                    |-- Check email unique>|               |
   |                          |                    |<- Not found (OK)  ---|               |
   |                          |                    |-- Hash password      |               |
   |                          |                    |-- Store user record->|               |
   |                          |                    |-- Generate verify    |               |
   |                          |                    |   token, store it  ->|               |
   |                          |                    |-- Send verify email  |               |
   |                          |                    |   ---------------------------------->|
   |                          |                    |<- SES accepted -------------------- |
   |                          |<- 201 Created -----|                      |               |
   |<-- 201 (check email) ----|                    |                      |               |
```

---

### 3.2 Authenticated API Request Flow (e.g. Create Invoice)

```
Browser              API Gateway         JWTAuthorizer        InvoicesLambda       DynamoDB
   |                      |                    |                     |                  |
   |-- POST /invoices  -->|                    |                     |                  |
   |   Authorization:     |                    |                     |                  |
   |   Bearer <token>     |                    |                     |                  |
   |                      |-- Invoke Auth  --->|                     |                  |
   |                      |                    |-- Verify JWT sig    |                  |
   |                      |                    |-- Check expiry      |                  |
   |                      |                    |-- Extract userId    |                  |
   |                      |<-- Allow + userId--|                     |                  |
   |                      |-- Invoke Lambda,   |                     |                  |
   |                      |   context.userId ->|-------------------->|                  |
   |                      |                    |                     |-- Validate input |
   |                      |                    |                     |-- Atomic counter>|
   |                      |                    |                     |<- counter value--|
   |                      |                    |                     |-- Calc totals    |
   |                      |                    |                     |-- Write invoice->|
   |                      |                    |                     |<- Confirmed   ---|
   |                      |<-------------------|----- 201 Created ---|                  |
   |<-- 201 Created  -----|                    |                     |                  |
```

---

### 3.3 PDF Generation Flow

```
Browser              API Gateway         JWTAuthorizer         PDFLambda            DynamoDB
   |                      |                    |                    |                    |
   |-- GET /invoices      |                    |                    |                    |
   |   /:id/pdf --------->|                    |                    |                    |
   |                      |-- Invoke Auth  --->|                    |                    |
   |                      |<-- Allow + userId--|                    |                    |
   |                      |-- Invoke Lambda -->|------------------->|                    |
   |                      |                    |                    |-- Fetch invoice  ->|
   |                      |                    |                    |-- Fetch client   ->|
   |                      |                    |                    |<- Data ------------|
   |                      |                    |                    |-- Render PDF       |
   |                      |                    |                    |   (PDFKit, in mem) |
   |                      |<-------------------|--- PDF binary -----|                    |
   |<-- PDF binary -------|                    |                    |                    |
   |   (browser downloads)|                    |                    |                    |
```

---

### 3.4 Token Refresh Flow

```
Browser                    API Gateway            AuthLambda              DynamoDB
   |                            |                      |                      |
   | (access token near expiry) |                      |                      |
   |-- POST /auth/refresh ----->|                      |                      |
   |   Cookie: refreshToken     |                      |                      |
   |                            |-- Invoke Lambda  --->|                      |
   |                            |                      |-- Verify refresh JWT |
   |                            |                      |-- Lookup token hash->|
   |                            |                      |<- Found, not revoked-|
   |                            |                      |-- Issue new access   |
   |                            |                      |   + refresh tokens   |
   |                            |                      |-- Replace token    ->|
   |                            |                      |   hash in DB         |
   |                            |<-- new accessToken --|                      |
   |                            |    Set-Cookie:       |                      |
   |                            |    refreshToken      |                      |
   |<-- 200 + new accessToken --|                      |                      |
```

---

## 4. Authentication and Authorization Approach

### 4.1 Authentication Mechanism

**Scheme:** Custom JWT (HS256) — no third-party auth provider.

| Token | Storage | Expiry | Purpose |
|---|---|---|---|
| Access Token | JavaScript memory (never localStorage) | 15 minutes | Authenticate API requests via `Authorization: Bearer` header |
| Refresh Token | `HttpOnly`, `Secure`, `SameSite=Strict` cookie | 7 days | Obtain new access tokens without re-login |

**Why memory for access token:**
Storing in `localStorage` exposes the token to XSS attacks. Memory storage means the token is lost on page refresh, but the refresh token cookie silently rehydrates a new access token on load — transparent to the user.

**Refresh Token Rotation:**
Every use of a refresh token issues a brand-new access + refresh token pair. The old refresh token is invalidated immediately. Detecting a reuse of an already-invalidated token triggers full session revocation (all refresh tokens for that user deleted).

### 4.2 Password Security

- Passwords hashed with **bcrypt**, cost factor **12**
- Plaintext password never logged, stored, or returned in any response
- Password reset tokens are single-use, expiring after 1 hour, stored as a bcrypt hash in DynamoDB

### 4.3 Authorization Model

**Model:** Simple ownership-based authorization (no RBAC in MVP — single user role).

Every Lambda function receives `userId` from the JWT Authorizer via API Gateway request context. Business logic enforces:

```
All DynamoDB queries MUST filter by userId extracted from authorizer context.
userId from request body/path params is NEVER trusted for authorization decisions.
```

**Example enforcement in InvoicesLambda:**
```typescript
// CORRECT — userId from verified JWT context
const invoice = await db.getInvoice({
  pk: `USER#${event.requestContext.authorizer.userId}`,
  sk: `INVOICE#${event.pathParameters.id}`
});

// WRONG — never do this
const invoice = await db.getInvoice({
  invoiceId: event.pathParameters.id  // no user scoping!
});
```

### 4.4 Email Verification

- On registration, a UUID verification token is generated and stored (hashed) in DynamoDB with a 24-hour TTL
- A verification link is sent via SES: `https://app.quickinvoice.com/verify-email?token=<uuid>`
- Unverified accounts cannot log in (login returns `403 Email not verified`)
- Token is single-use — consumed on verification

### 4.5 Security Headers

API Gateway and CloudFront are configured to return:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 5. Data Storage and Encryption Strategy

### 5.1 DynamoDB — Single Table Design

**Table Name:** `quickinvoice-{env}`  
**Billing:** On-demand (pay-per-request) — suits MVP scale  
**Encryption:** AWS-managed encryption at rest (AES-256) enabled by default

#### Access Patterns and Key Design

| Entity | PK | SK | GSI1-PK | GSI1-SK | Purpose |
|---|---|---|---|---|---|
| User | `USER#<userId>` | `PROFILE` | `EMAIL#<email>` | `USER` | Lookup by email at login |
| RefreshToken | `USER#<userId>` | `RTOKEN#<tokenId>` | — | — | Token validation and rotation |
| EmailVerifyToken | `USER#<userId>` | `VTOKEN#<tokenId>` | — | — | Email verification (TTL set) |
| PasswordResetToken | `USER#<userId>` | `PRTOKEN#<tokenId>` | — | — | Password reset (TTL set) |
| InvoiceCounter | `USER#<userId>` | `COUNTER` | — | — | Atomic invoice number increment |
| Client | `USER#<userId>` | `CLIENT#<clientId>` | — | — | List all clients for user |
| Invoice | `USER#<userId>` | `INVOICE#<invoiceId>` | `USER#<userId>` | `STATUS#<status>#<createdAt>` | List invoices by status |

**GSI1** (`gsi1pk` / `gsi1sk`):
- **EMAIL lookup:** `gsi1pk = EMAIL#<email>` → used at login to find user by email
- **Invoice by status:** `gsi1pk = USER#<userId>`, `gsi1sk = STATUS#<status>#<iso-date>` → list invoices filtered by status

#### Invoice Item Schema

```json
{
  "pk":          "USER#abc123",
  "sk":          "INVOICE#inv456",
  "gsi1pk":      "USER#abc123",
  "gsi1sk":      "STATUS#draft#2026-06-30T10:00:00Z",
  "invoiceId":   "inv456",
  "userId":      "abc123",
  "clientId":    "cli789",
  "invoiceNumber": "INV-007",
  "status":      "draft",
  "issueDate":   "2026-06-30",
  "dueDate":     "2026-07-30",
  "currency":    "AUD",
  "lineItems": [
    {
      "description": "Website design",
      "quantity":    1,
      "unitPrice":   150000,
      "taxRate":     10
    }
  ],
  "subtotal":    150000,
  "taxTotal":    15000,
  "grandTotal":  165000,
  "notes":       "Payment due within 30 days.",
  "createdAt":   "2026-06-30T10:00:00Z",
  "updatedAt":   "2026-06-30T10:00:00Z",
  "sentAt":      null,
  "paidAt":      null,
  "deletedAt":   null
}
```

> **Note on monetary values:** All monetary amounts are stored as **integer cents** (AUD cents) to avoid floating-point arithmetic errors. `150000` = AUD $1,500.00. All business logic works in cents; formatting to dollars/cents is a display-layer concern only.

#### User Item Schema

```json
{
  "pk":              "USER#abc123",
  "sk":              "PROFILE",
  "gsi1pk":         "EMAIL#jane@example.com",
  "gsi1sk":         "USER",
  "userId":         "abc123",
  "email":          "jane@example.com",
  "passwordHash":   "$2b$12$...",
  "displayName":    "Jane Smith",
  "invoicePrefix":  "INV",
  "emailVerified":  true,
  "createdAt":      "2026-06-01T00:00:00Z",
  "updatedAt":      "2026-06-01T00:00:00Z"
}
```

### 5.2 Encryption Strategy

| Layer | Mechanism | Detail |
|---|---|---|
| Data at rest (DynamoDB) | AWS-managed AES-256 | Enabled by default on all DynamoDB tables |
| Data in transit | TLS 1.2+ | Enforced by CloudFront (HTTPS only, redirect HTTP) and API Gateway |
| Passwords | bcrypt (cost 12) | One-way hash; plaintext never stored |
| Verification / reset tokens | bcrypt hash | Only hash stored in DB; raw token sent in email link only |
| JWT signing secret | HS256, 256-bit key | Stored in AWS Secrets Manager; retrieved at Lambda cold-start |
| Refresh tokens | Stored as SHA-256 hash | Raw token only in cookie; hash in DB for comparison |
| S3 static assets | SSE-S3 | Server-side encryption for S3 bucket |

### 5.3 Data Isolation

- All DynamoDB items are partitioned by `USER#<userId>` — a misconfigured query cannot inadvertently return another user's data
- Lambda functions never accept `userId` from client-controlled input for authorization; always sourced from the verified JWT context
- No cross-user foreign key traversal is possible by design

---

## 6. External Integrations

### 6.1 AWS SES (Simple Email Service)

| Attribute | Detail |
|---|---|
| **Purpose** | Send email verification and password reset emails |
| **Integration Point** | AuthLambda calls AWS SDK `SES.sendEmail()` |
| **Sender** | `noreply@quickinvoice.com` (domain must be verified in SES) |
| **MVP Mode** | SES sandbox — only pre-verified recipient addresses can receive email |
| **Production** | Request SES production access to send to any address |
| **Templates** | Inline HTML templates in Lambda code (no SES template service in MVP) |
| **Failure Handling** | SES send failure is logged and returns a generic error to user; does not silently swallow the error |

**Emails sent:**
1. **Verify your email** — on registration; contains single-use link valid 24 hours
2. **Reset your password** — on forgot-password request; contains single-use link valid 1 hour

### 6.2 PDFKit (npm package — server-side PDF generation)

| Attribute | Detail |
|---|---|
| **Purpose** | Generate invoice PDFs on-demand in Lambda |
| **Library** | `pdfkit` (pure JavaScript, no Chromium dependency) |
| **Integration Point** | PDFLambda — fetches data from DynamoDB, renders to in-memory buffer, streams to response |
| **Template** | Fixed platform template defined in code — company name, invoice fields, line items table, totals, footer |
| **Output** | Binary PDF returned directly in API response (base64-encoded via API Gateway binary support) |
| **No storage** | PDFs are never written to S3 or DynamoDB — generated fresh on every request |

### 6.3 AWS Secrets Manager

| Attribute | Detail |
|---|---|
| **Purpose** | Securely store and retrieve runtime secrets |
| **Secrets stored** | JWT signing secret, SES SMTP credentials (if needed) |
| **Access pattern** | Lambda retrieves secret at cold-start, caches for instance lifetime |
| **IAM** | Each Lambda function has a least-privilege IAM role with `secretsmanager:GetSecretValue` only for its specific secret ARN |

### 6.4 AWS CloudWatch (Observability)

| Attribute | Detail |
|---|---|
| **Purpose** | Logs, metrics, and basic alerting |
| **Integration** | Automatic — all Lambda invocations write stdout/stderr to CloudWatch Logs |
| **Log groups** | One log group per Lambda function |
| **Structured logging** | All Lambda functions emit JSON-structured logs with `requestId`, `userId`, `action`, `durationMs` |
| **Alarms (MVP)** | Lambda error rate alarm — alert if error rate > 5% over 5 minutes |

### 6.5 Post-MVP Integration Candidates (Out of Scope Now)

| Integration | Purpose | When |
|---|---|---|
| Stripe | Subscription billing ($9/month plan + trial) | Post-MVP |
| AWS SES (expanded) | Platform-sent invoice emails to clients | Post-MVP |
| AWS S3 (invoice storage) | Store generated PDFs for audit trail | Post-MVP |
| Google / GitHub OAuth | Social login | Post-MVP |

---

## 7. Deployment Architecture

### 7.1 Infrastructure as Code

**Tool:** AWS SAM (Serverless Application Model)

All infrastructure defined in `template.yaml`:
- Lambda functions (one per logical group)
- API Gateway REST API + JWT Authorizer
- DynamoDB table + GSI
- S3 bucket (static frontend)
- CloudFront distribution
- IAM roles (least-privilege per Lambda)
- Secrets Manager secret references
- CloudWatch alarms

### 7.2 Environments

| Environment | Purpose | Domain |
|---|---|---|
| `dev` | Local development | `localhost` via SAM local |
| `staging` | Integration testing | `staging.quickinvoice.com` |
| `prod` | Live application | `app.quickinvoice.com` |

### 7.3 Lambda Configuration

| Function | Memory | Timeout | Notes |
|---|---|---|---|
| AuthLambda | 256 MB | 10s | bcrypt is CPU-intensive |
| JWTAuthorizerLambda | 128 MB | 3s | Must be fast — on every request |
| ClientsLambda | 128 MB | 10s | |
| InvoicesLambda | 128 MB | 10s | |
| PDFLambda | 512 MB | 30s | PDFKit rendering |
| DashboardLambda | 128 MB | 15s | Aggregation over user's invoices |
| UsersLambda | 128 MB | 10s | |

### 7.4 Cold Start Mitigation

- JWTAuthorizerLambda uses provisioned concurrency (1 instance) — this function runs on every request, cold starts here cause the most user-visible latency
- All other functions rely on Lambda's built-in keep-warm behaviour at MVP scale (1–5 users)
- Secrets Manager secrets cached in module scope, not re-fetched per invocation

---

## 8. Key Architectural Decisions and Trade-offs

| Decision | Choice | Trade-off |
|---|---|---|
| **Frontend framework** | Vanilla HTML/CSS/JS | Simple deployment, no build step. Complex dashboard state (charts, real-time totals) will require disciplined vanilla JS patterns. Accepted by product owner. |
| **Database** | DynamoDB single-table | No connection pool issues in Lambda; auto-scales. Trade-off: less flexible ad-hoc queries; aggregation (dashboard) must be done in Lambda memory, not SQL. |
| **Monetary storage** | Integer cents | Eliminates floating-point errors in financial calculations. Requires formatting layer for display. |
| **PDF generation** | PDFKit (no Chromium) | Small Lambda package size, fast cold start. Trade-off: PDF layout built programmatically, not from HTML template — less flexible visually. |
| **Auth** | Custom JWT, no Cognito | Full control, no vendor lock-in, no Cognito pricing. Trade-off: more code to maintain; must implement refresh rotation, revocation, and email flows manually. |
| **Single table DynamoDB** | Yes | Efficient access patterns for known queries. Trade-off: schema is less intuitive; dashboard aggregation fetches all user invoices into Lambda memory (acceptable at MVP scale). |
| **No email sending (MVP)** | PDF download only | Removes SES sending complexity for the happy path. Trade-off: freelancer must send invoice manually — reduces automation value proposition. |
