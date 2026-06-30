# QuickInvoice — Component Dependencies

## Dependency Matrix

| Component | Depends On |
|---|---|
| Frontend | AuthService, ClientService, InvoiceService, PDFService, DashboardService, UserService |
| JWTAuthorizer | Secrets Manager (RSA public key) |
| AuthService | DynamoDB, SES, Secrets Manager (RSA private key) |
| ClientService | DynamoDB, JWTAuthorizer (via API Gateway) |
| InvoiceService | DynamoDB, JWTAuthorizer (via API Gateway) |
| PDFService | DynamoDB, InvoiceService (data fetch), JWTAuthorizer (via API Gateway) |
| DashboardService | DynamoDB, JWTAuthorizer (via API Gateway) |
| UserService | DynamoDB, JWTAuthorizer (via API Gateway) |

## Communication Patterns

- **Frontend → API Gateway**: HTTPS REST, `Authorization: Bearer <access_token>` header
- **API Gateway → JWTAuthorizer**: Synchronous Lambda invocation before every protected route
- **API Gateway → Lambda**: Synchronous invocation after authorization passes; `userId` injected in context
- **Lambda → DynamoDB**: AWS SDK v3 direct calls (no connection pooling needed)
- **AuthService → SES**: AWS SDK `SES.sendEmail()` for transactional email
- **JWTAuthorizer/AuthService → Secrets Manager**: AWS SDK `GetSecretValue` (module-scope cached)

## Key Design Rules

1. `userId` ALWAYS sourced from `event.requestContext.authorizer.userId` (JWT context) — never from request body or path params
2. No Lambda calls another Lambda directly — all orchestration is stateless per-request
3. No shared mutable state between Lambda instances (DynamoDB is the only shared state)
4. PDFService fetches its own data from DynamoDB — does not call InvoiceService Lambda
