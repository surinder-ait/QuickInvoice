# QuickInvoice — Component Definitions

## Component: AuthService

**Purpose**: Manages all user identity lifecycle operations.

**Responsibilities**:
- Register new users (validate, hash password, store, trigger email verification)
- Authenticate users (validate credentials, issue RS256 JWT access + refresh token pair)
- Refresh access tokens (validate refresh token, rotate pair)
- Logout (revoke refresh token)
- Verify email addresses (validate token, activate account)
- Initiate and complete password reset flow
- Enforce brute-force protection on login

**Interfaces**:
- `POST /auth/register` → `RegisterRequest` → `RegisterResponse`
- `POST /auth/login` → `LoginRequest` → `TokenPair`
- `POST /auth/logout` → `LogoutRequest` → `void`
- `POST /auth/refresh` → `RefreshRequest` → `TokenPair`
- `GET /auth/verify-email?token=` → `void`
- `POST /auth/forgot-password` → `ForgotPasswordRequest` → `void`
- `POST /auth/reset-password` → `ResetPasswordRequest` → `void`

---

## Component: JWTAuthorizer

**Purpose**: Validates RS256 JWTs on every protected API request.

**Responsibilities**:
- Fetch RSA public key from Secrets Manager / Parameter Store (cached per Lambda instance)
- Verify JWT signature (RS256), expiry, issuer, audience, and `tokenVersion` claim
- Reject tokens with stale `tokenVersion` (supports mass revocation)
- Inject verified `userId` into API Gateway request context for downstream Lambdas
- Return IAM Allow/Deny policy

**Interfaces**:
- API Gateway Lambda Authorizer (TOKEN type)
- Input: `Authorization: Bearer <token>` header
- Output: IAM policy document + `context.userId`

---

## Component: ClientService

**Purpose**: Manages client (customer) records owned by a freelancer.

**Responsibilities**:
- Create client (name + email, scoped to userId)
- List all active clients for a user
- Get single client by ID (ownership enforced)
- Update client name/email
- Soft-delete client (set `deletedAt`; invoices retained)

**Interfaces**:
- `GET /clients` → `Client[]`
- `POST /clients` → `CreateClientRequest` → `Client`
- `GET /clients/:id` → `Client`
- `PUT /clients/:id` → `UpdateClientRequest` → `Client`
- `DELETE /clients/:id` → `void`

---

## Component: InvoiceService

**Purpose**: Manages the full invoice lifecycle for a freelancer.

**Responsibilities**:
- Create invoice (auto-number, compute totals server-side)
- List invoices (all statuses, sorted by updatedAt)
- Get single invoice (ownership enforced)
- Update draft invoice (reject updates on sent/paid)
- Delete draft invoice
- Duplicate invoice (new draft, new number)
- Transition invoice status (draft→sent, sent→paid, sent→viewed→paid)
- Record status change timestamps

**Interfaces**:
- `GET /invoices` → `Invoice[]`
- `POST /invoices` → `CreateInvoiceRequest` → `Invoice`
- `GET /invoices/:id` → `Invoice`
- `PUT /invoices/:id` → `UpdateInvoiceRequest` → `Invoice`
- `DELETE /invoices/:id` → `void`
- `POST /invoices/:id/duplicate` → `Invoice`
- `PATCH /invoices/:id/status` → `StatusTransitionRequest` → `Invoice`

---

## Component: PDFService

**Purpose**: Generates invoice PDF documents on-demand.

**Responsibilities**:
- Fetch invoice and associated client data
- Render PDF using PDFKit with fixed platform template
- Stream binary PDF response (never persisted)

**Interfaces**:
- `GET /invoices/:id/pdf` → `application/pdf` binary

---

## Component: DashboardService

**Purpose**: Computes analytics aggregations for the freelancer dashboard.

**Responsibilities**:
- Fetch all invoices for user
- Compute: outstanding total, overdue total, revenue this month, revenue this year
- Compute: recent activity (last 10 invoices), top 5 clients by revenue, average payment time
- Return computed summary

**Interfaces**:
- `GET /dashboard` → `DashboardSummary`

---

## Component: UserService

**Purpose**: Manages user profile and account settings.

**Responsibilities**:
- Get current user profile
- Update invoice number prefix (alphanumeric, 1–10 chars)
- Update display name

**Interfaces**:
- `GET /users/me` → `UserProfile`
- `PUT /users/me` → `UpdateProfileRequest` → `UserProfile`

---

## Component: Frontend (Static Web Application)

**Purpose**: Browser-based UI for all freelancer interactions.

**Responsibilities**:
- Render all pages (login, register, dashboard, clients, invoices, editor)
- Manage access token in memory; refresh token via HttpOnly cookie
- Call REST API with `Authorization: Bearer` header
- Client-side invoice total preview (display only; server recalculates on save)
- Trigger PDF download
- Handle token expiry silently via background refresh

**Pages**: `/login`, `/register`, `/verify-email`, `/reset-password`, `/dashboard`, `/clients`, `/clients/new`, `/clients/:id`, `/invoices`, `/invoices/new`, `/invoices/:id`
