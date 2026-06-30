# QuickInvoice — Execution Plan

## Detailed Analysis Summary

### Change Impact Assessment
- **User-facing changes**: Yes — full greenfield SaaS product: auth, client management, invoicing, dashboard
- **Structural changes**: Yes — serverless AWS architecture from scratch
- **Data model changes**: Yes — DynamoDB single-table design, all entities new
- **API changes**: Yes — full REST API (Lambda + API Gateway)
- **NFR impact**: Yes — Security (RS256 JWT, rotation policy), Resiliency, PBT all enabled

### Risk Assessment
- **Risk Level**: Medium — well-scoped greenfield MVP, no brownfield complexity, 2-hour timeline constraint
- **Rollback Complexity**: Easy — greenfield, nothing to break
- **Testing Complexity**: Moderate — financial calculations require PBT, auth flows require integration tests

---

## Workflow Visualization

```
INCEPTION PHASE
+-------------------------------+
| Workspace Detection  DONE     |
| Reverse Engineering  SKIPPED  |
| Requirements Analysis DONE    |
| User Stories         SKIPPED  |
| Workflow Planning    EXECUTE  |
| Application Design   EXECUTE  |
| Units Generation     EXECUTE  |
+-------------------------------+
             |
             v
CONSTRUCTION PHASE
+-------------------------------+
| Functional Design    EXECUTE  |
| NFR Requirements     EXECUTE  |
| NFR Design           EXECUTE  |
| Infrastructure Design EXECUTE |
| Code Generation      EXECUTE  |
| Build and Test       EXECUTE  |
+-------------------------------+
             |
             v
OPERATIONS PHASE
+-------------------------------+
| Operations           PLACEHOLDER|
+-------------------------------+
```

---

## Phases to Execute

### 🔵 INCEPTION PHASE
- [x] Workspace Detection — COMPLETED
- [x] Reverse Engineering — SKIPPED (Greenfield)
- [x] Requirements Analysis — COMPLETED (incl. design review addendum)
- [ ] User Stories — SKIPPED
  - **Rationale**: Solo MVP, single user persona (freelancer), scope is clear from requirements. User stories add no value here.
- [x] Workflow Planning — IN PROGRESS
- [ ] Application Design — EXECUTE
  - **Rationale**: New serverless system with 7 Lambda functions, DynamoDB table, API Gateway. Component boundaries, method signatures, and service orchestration need explicit definition before code generation.
- [ ] Units Generation — EXECUTE
  - **Rationale**: System has multiple logical units (Auth, Clients, Invoices, PDF, Dashboard) that benefit from explicit decomposition before construction.

### 🟢 CONSTRUCTION PHASE
- [ ] Functional Design — EXECUTE (per unit)
  - **Rationale**: Financial calculation logic (totals, tax), invoice state machine, dashboard aggregations are complex enough to warrant explicit business logic design before coding.
- [ ] NFR Requirements — EXECUTE (per unit)
  - **Rationale**: RS256 JWT rotation, security extension (15 rules), resiliency baseline, PBT extension all require explicit NFR design work per unit.
- [ ] NFR Design — EXECUTE (per unit)
  - **Rationale**: Security patterns (auth middleware, input validation, rate limiting), resiliency patterns (retry, cold-start handling) need design artifacts.
- [ ] Infrastructure Design — EXECUTE (per unit)
  - **Rationale**: Lambda configs, DynamoDB GSIs, API Gateway routes, IAM roles, Secrets Manager, SAM template all need specification.
- [ ] Code Generation — EXECUTE (always, per unit)
- [ ] Build and Test — EXECUTE (always)

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

---

## Unit Decomposition Preview

The system will be decomposed into these units (confirmed in Units Generation):

| Unit | Key Responsibilities |
|---|---|
| **auth** | Registration, login, logout, JWT (RS256), refresh rotation, email verify, password reset |
| **clients** | Client CRUD, user scoping |
| **invoices** | Invoice CRUD, line items, totals, status machine, invoice numbering, duplicate |
| **pdf** | On-demand PDF generation (PDFKit), invoice rendering |
| **dashboard** | Analytics aggregations, revenue metrics, top clients |

---

## Success Criteria
- **Primary Goal**: Working QuickInvoice MVP — auth + clients + invoices + PDF + dashboard
- **Key Deliverables**: TypeScript Lambda functions, DynamoDB table, API Gateway, plain HTML/JS frontend, SAM template
- **Quality Gates**: All security extension rules compliant, PBT for financial calculations, integration tests for all API endpoints
