# QuickInvoice — Code Generation Plan

**Workspace Root**: `c:\Surinder\Training\AgenticAI\QuickInvoice`  
**Project Structure**: Greenfield monorepo — `src/{unit}/`, `frontend/`, `tests/`  
**Stories**: AUTH-01–09, CLI-01–04, INV-01–10, PDF-01–02, DASH-01–06, FE-01–04

---

## Step 1: Project Scaffolding
- [x] 1.1 Create `package.json` (TypeScript, Node 20, AWS SAM, dependencies)
- [x] 1.2 Create `tsconfig.json` (strict mode, ESNext, Node target)
- [x] 1.3 Create `template.yaml` (SAM template — all Lambda functions, API Gateway, DynamoDB, S3, CloudFront, IAM roles)
- [x] 1.4 Create `.env.example` (all required environment variable names, no values)
- [x] 1.5 Create `src/shared/db/dynamodb-client.ts`
- [x] 1.6 Create `src/shared/db/table-keys.ts` (PK/SK builders for all entities)
- [x] 1.7 Create `src/shared/types/` (all domain type definitions)
- [x] 1.8 Create `src/shared/utils/validation.ts` (Zod schemas — all request bodies)
- [x] 1.9 Create `src/shared/utils/logger.ts` (structured JSON logger — SECURITY-03)
- [x] 1.10 Create `src/shared/utils/error-handler.ts` (global Lambda error handler — SECURITY-15)
- [x] 1.11 Create `src/shared/utils/response.ts` (API Gateway response builders)
- [x] 1.12 Create `src/shared/middleware/auth-middleware.ts` (userId extraction from context)

---

## Step 2: Unit — auth (Stories: AUTH-01–09)

### 2.1 Business Logic
- [x] 2.1.1 Create `src/auth/services/auth-service.ts`
- [x] 2.1.2 Create `src/auth/services/token-service.ts`
- [x] 2.1.3 Create `src/auth/services/brute-force-service.ts`

### 2.2 Unit Tests — auth
- [x] 2.2.1 Create `tests/unit/auth/auth-service.test.ts`
- [x] 2.2.2 Create `tests/unit/auth/token-service.test.ts`

### 2.3 Lambda Handlers
- [x] 2.3.1 Create `src/auth/handlers/auth-handler.ts`
- [x] 2.3.2 Create `src/auth/handlers/jwt-authorizer-handler.ts`

### 2.4 Auth Lambda Handler Tests
- [x] 2.4.1 Create `tests/unit/auth/auth-handler.test.ts`

### 2.5 Auth Documentation Summary
- [x] 2.5.1 Create `aidlc-docs/construction/auth/code/auth-summary.md`

---

## Step 3: Unit — clients (Stories: CLI-01–04)

### 3.1 Business Logic
- [x] 3.1.1 Create `src/clients/services/client-service.ts`

### 3.2 Unit Tests — clients
- [x] 3.2.1 Create `tests/unit/clients/client-service.test.ts`

### 3.3 Lambda Handler
- [x] 3.3.1 Create `src/clients/handlers/clients-handler.ts`

### 3.4 Client Handler Tests
- [x] 3.4.1 Create `tests/unit/clients/clients-handler.test.ts`

### 3.5 Clients Documentation Summary
- [x] 3.5.1 Create `aidlc-docs/construction/clients/code/clients-summary.md`

---

## Step 4: Unit — invoices (Stories: INV-01–10)

### 4.1 Business Logic
- [x] 4.1.1 Create `src/invoices/services/invoice-service.ts`
- [x] 4.1.2 Create `src/invoices/services/invoice-calculator.ts`

### 4.2 Unit Tests — invoices
- [x] 4.2.1 Create `tests/unit/invoices/invoice-calculator.test.ts` (PBT)
- [x] 4.2.2 Create `tests/unit/invoices/invoice-service.test.ts`

### 4.3 Lambda Handler
- [x] 4.3.1 Create `src/invoices/handlers/invoices-handler.ts`

### 4.4 Invoice Handler Tests
- [x] 4.4.1 Create `tests/unit/invoices/invoices-handler.test.ts`

### 4.5 Invoices Documentation Summary
- [x] 4.5.1 Create `aidlc-docs/construction/invoices/code/invoices-summary.md`

---

## Step 5: Unit — pdf (Stories: PDF-01–02)

### 5.1 Business Logic
- [x] 5.1.1 Create `src/pdf/services/pdf-service.ts`
- [x] 5.1.2 Create `src/pdf/templates/invoice-template.ts`

### 5.2 Unit Tests — pdf
- [x] 5.2.1 Create `tests/unit/pdf/pdf-service.test.ts`

### 5.3 Lambda Handler
- [x] 5.3.1 Create `src/pdf/handlers/pdf-handler.ts`

### 5.4 PDF Documentation Summary
- [x] 5.4.1 Create `aidlc-docs/construction/pdf/code/pdf-summary.md`

---

## Step 6: Unit — dashboard (Stories: DASH-01–06)

### 6.1 Business Logic
- [x] 6.1.1 Create `src/dashboard/services/dashboard-service.ts`
- [x] 6.1.2 Create `src/dashboard/services/dashboard-calculator.ts`

### 6.2 Unit Tests — dashboard
- [x] 6.2.1 Create `tests/unit/dashboard/dashboard-calculator.test.ts` (PBT)

### 6.3 Lambda Handler
- [x] 6.3.1 Create `src/dashboard/handlers/dashboard-handler.ts`

### 6.4 Dashboard Documentation Summary
- [x] 6.4.1 Create `aidlc-docs/construction/dashboard/code/dashboard-summary.md`

---

## Step 7: Unit — frontend (Stories: FE-01–04)

### 7.1 API Client Module
- [x] 7.1.1 Create `frontend/js/api-client.js`

### 7.2 Authentication Pages
- [x] 7.2.1 Create `frontend/login.html` + `frontend/js/login.js`
- [x] 7.2.2 Create `frontend/register.html` + `frontend/js/register.js`
- [ ] 7.2.3 Create `frontend/verify-email.html` + `frontend/js/verify-email.js`
- [ ] 7.2.4 Create `frontend/reset-password.html` + `frontend/js/reset-password.js`

### 7.3 Dashboard Page
- [x] 7.3.1 Create `frontend/dashboard.html` + `frontend/js/dashboard.js`

### 7.4 Clients Pages
- [ ] 7.4.1 Create `frontend/clients.html` + `frontend/js/clients.js`
- [ ] 7.4.2 Create `frontend/client-form.html` + `frontend/js/client-form.js`

### 7.5 Invoices Pages
- [ ] 7.5.1 Create `frontend/invoices.html` + `frontend/js/invoices.js`
- [ ] 7.5.2 Create `frontend/invoice-editor.html` + `frontend/js/invoice-editor.js`

### 7.6 Shared Frontend Assets
- [x] 7.6.1 Create `frontend/css/main.css`
- [x] 7.6.2 Create `frontend/css/components.css`
- [ ] 7.6.3 Create `frontend/js/router.js`
- [ ] 7.6.4 Create `frontend/index.html`

### 7.7 Frontend Documentation Summary
- [ ] 7.7.1 Create `aidlc-docs/construction/frontend/code/frontend-summary.md`

---

## Step 8: Security Hardening
- [x] 8.1 Security headers in response.ts (SECURITY-04)
- [x] 8.2 Zod validation on all inputs (SECURITY-05)
- [x] 8.3 Least-privilege IAM in template.yaml (SECURITY-06)
- [x] 8.4 CloudWatch log retention 90d + alarms (SECURITY-14)
- [x] 8.5 Rate limiting on API Gateway (SECURITY-11)
- [x] 8.6 Create `docs/credential-compromise-procedure.md` (SECURITY-12 / NFR-03.10)
- [ ] 8.7 Add package-lock.json and vulnerability scan step (SECURITY-10)

---

## Step 9: Build Configuration & Deployment Artifacts
- [x] 9.1 Create `README.md`
- [ ] 9.2 Create `Makefile`
- [x] 9.3 `template.yaml` complete

---

## Step 10: Integration Tests

- [ ] 10.1 Create `tests/integration/auth.integration.test.ts` (register → verify → login → refresh → logout)
- [ ] 10.2 Create `tests/integration/clients.integration.test.ts` (CRUD flow)
- [ ] 10.3 Create `tests/integration/invoices.integration.test.ts` (create → edit → status transitions → duplicate)
- [ ] 10.4 Create `tests/integration/pdf.integration.test.ts` (generate PDF for known invoice)
- [ ] 10.5 Create `tests/integration/dashboard.integration.test.ts` (metrics reflect invoice state)

---

## Security Compliance Checklist (enforced at code generation)

| Rule | Status |
|---|---|
| SECURITY-01: Encryption at rest + transit | To verify in template.yaml (DynamoDB encryption, HTTPS-only) |
| SECURITY-02: Access logging on API Gateway + CloudFront | To add in template.yaml |
| SECURITY-03: Structured logging in all Lambdas | logger.ts applied to all handlers |
| SECURITY-04: HTTP security headers | Response builder middleware |
| SECURITY-05: Input validation on all API endpoints | Zod schemas on all handlers |
| SECURITY-06: Least-privilege IAM | Per-Lambda IAM roles in template.yaml |
| SECURITY-07: Network config (N/A — no VPC in MVP) | N/A — serverless, no VPC |
| SECURITY-08: App-level access control (IDOR prevention) | userId from JWT context only |
| SECURITY-09: Error handling — no stack traces to users | error-handler.ts global handler |
| SECURITY-10: Dependency pinning + vulnerability scan | package-lock.json + npm audit |
| SECURITY-11: Rate limiting on public endpoints | API Gateway Usage Plan |
| SECURITY-12: Auth — bcrypt, brute-force, RS256 rotation | auth-service + token-service |
| SECURITY-13: SRI hashes for CDN resources (Chart.js) | dashboard.html |
| SECURITY-14: Alerting + log retention | template.yaml CloudWatch alarms |
| SECURITY-15: Global error handler + fail closed | error-handler.ts |
