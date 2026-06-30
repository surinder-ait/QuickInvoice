# QuickInvoice — Unit of Work Dependencies

## Dependency Matrix

| Unit | Depends On | Reason |
|---|---|---|
| auth | shared | DynamoDB client, types, JWT utilities |
| clients | auth, shared | Auth must be deployed first (JWTAuthorizer); shares DynamoDB table |
| invoices | auth, clients, shared | Auth (authorizer); clients (clientId foreign key); shared DynamoDB |
| pdf | auth, invoices, clients, shared | Auth (authorizer); reads invoice + client data |
| dashboard | auth, invoices, shared | Auth (authorizer); reads invoice data |
| frontend | all API units | Consumes all REST endpoints |

## Development Sequence

Since all units deploy as a single SAM stack, the build order is:

```
1. shared      (no dependencies)
2. auth        (depends on shared)
3. clients     (depends on auth + shared)
4. invoices    (depends on auth + clients + shared)
5. pdf         (depends on auth + invoices + clients + shared)
6. dashboard   (depends on auth + invoices + shared)
7. frontend    (depends on all API units being defined)
```

## Shared Module Contents

```
src/shared/
  db/
    dynamodb-client.ts     ← AWS SDK DynamoDB DocumentClient singleton
    table-keys.ts          ← PK/SK key builders for all entities
  types/
    user.types.ts
    client.types.ts
    invoice.types.ts
    dashboard.types.ts
    auth.types.ts
  utils/
    validation.ts          ← Zod schemas for all request/response types
    error-handler.ts       ← Global Lambda error handler
    logger.ts              ← Structured JSON logger (CloudWatch)
    response.ts            ← API Gateway response builders
  middleware/
    auth-middleware.ts     ← userId extraction from authorizer context
```
