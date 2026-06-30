# QuickInvoice — Units of Work

## Deployment Model
**Monorepo, single deployable stack** — all Lambda functions deployed via a single AWS SAM template. Code organised as a monolith-style monorepo with per-unit source directories.

## Code Organisation Strategy
```
quickinvoice/                         ← workspace root
  src/
    auth/                             ← Unit: auth
    clients/                          ← Unit: clients
    invoices/                         ← Unit: invoices
    pdf/                              ← Unit: pdf
    dashboard/                        ← Unit: dashboard
    users/                            ← Unit: users (merged with auth config)
    shared/                           ← Shared types, DynamoDB client, utilities
  frontend/                           ← Unit: frontend (static HTML/CSS/JS)
  tests/
    unit/
    integration/
  template.yaml                       ← AWS SAM template
  tsconfig.json
  package.json
```

---

## Unit 1: auth

**Description**: User identity and session management.

**Scope**:
- User registration, email verification, login, logout
- RS256 JWT issuance and refresh token rotation
- Password reset flow
- Mass token revocation (tokenVersion increment)
- JWT Lambda Authorizer
- Brute-force login protection

**Lambda Functions**: `AuthFunction`, `JWTAuthorizerFunction`
**DynamoDB entities owned**: User, RefreshToken, EmailVerifyToken, PasswordResetToken
**External dependencies**: AWS SES, AWS Secrets Manager (RSA key pair)

---

## Unit 2: clients

**Description**: Client (customer) record management.

**Scope**:
- CRUD operations on client records
- Soft delete
- User-scoped data access

**Lambda Functions**: `ClientsFunction`
**DynamoDB entities owned**: Client

---

## Unit 3: invoices

**Description**: Invoice lifecycle management.

**Scope**:
- Invoice creation with auto-numbering (configurable prefix)
- Line item management
- Server-side financial calculations (in cents)
- Status state machine (draft→sent→viewed→paid)
- Invoice duplication
- Immutability enforcement on non-draft invoices

**Lambda Functions**: `InvoicesFunction`
**DynamoDB entities owned**: Invoice, InvoiceCounter

---

## Unit 4: pdf

**Description**: On-demand invoice PDF generation.

**Scope**:
- Fetch invoice + client data
- Render PDF with PDFKit (fixed template)
- Return binary PDF response (no storage)

**Lambda Functions**: `PDFFunction`
**DynamoDB entities read**: Invoice, Client (read-only, no ownership)

---

## Unit 5: dashboard

**Description**: Analytics aggregations for the freelancer dashboard.

**Scope**:
- Fetch and aggregate all user invoices
- Compute outstanding, overdue, monthly/yearly revenue, top clients, avg payment time

**Lambda Functions**: `DashboardFunction`
**DynamoDB entities read**: Invoice (read-only)

---

## Unit 6: frontend

**Description**: Static web application.

**Scope**:
- All HTML pages and routing (vanilla JS SPA pattern)
- API client module (fetch wrapper with token handling)
- Invoice editor with client-side total preview
- Dashboard UI with charts (Chart.js CDN with SRI hash per SECURITY-13)
- Deployed to S3 + CloudFront

**Output**: Static files in `frontend/` directory
