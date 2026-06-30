# QuickInvoice — Component Method Signatures

## AuthService

```typescript
registerUser(req: RegisterRequest): Promise<void>
// Validates email uniqueness, hashes password (bcrypt 12), creates user, sends verification email

loginUser(req: LoginRequest): Promise<TokenPair>
// Validates credentials, checks email verified, checks brute-force counter, issues RS256 JWT pair

refreshTokens(refreshToken: string): Promise<TokenPair>
// Validates refresh JWT (RS256), checks tokenVersion, rotates pair, revokes old token

logoutUser(userId: string, refreshTokenId: string): Promise<void>
// Deletes refresh token record from DynamoDB

verifyEmail(token: string): Promise<void>
// Validates verification token (expiry + single-use), marks user emailVerified=true

initiatePasswordReset(email: string): Promise<void>
// Generates reset token, stores hash, sends reset email via SES

completePasswordReset(token: string, newPassword: string): Promise<void>
// Validates reset token, hashes new password, updates user, revokes all refresh tokens
```

## JWTAuthorizer

```typescript
authorize(event: APIGatewayAuthorizerEvent): Promise<APIGatewayAuthorizerResult>
// Verifies RS256 JWT signature + expiry + tokenVersion; returns Allow/Deny IAM policy

getPublicKey(): Promise<string>
// Fetches RSA public key from Secrets Manager/SSM (cached in module scope)
```

## ClientService

```typescript
createClient(userId: string, req: CreateClientRequest): Promise<Client>
listClients(userId: string): Promise<Client[]>
getClient(userId: string, clientId: string): Promise<Client>
updateClient(userId: string, clientId: string, req: UpdateClientRequest): Promise<Client>
deleteClient(userId: string, clientId: string): Promise<void>  // soft delete
```

## InvoiceService

```typescript
createInvoice(userId: string, req: CreateInvoiceRequest): Promise<Invoice>
// Atomically increments invoice counter, formats number, calculates totals (cents), stores

listInvoices(userId: string, filters?: InvoiceFilters): Promise<Invoice[]>

getInvoice(userId: string, invoiceId: string): Promise<Invoice>

updateInvoice(userId: string, invoiceId: string, req: UpdateInvoiceRequest): Promise<Invoice>
// Rejects if status !== 'draft'; recalculates totals server-side

deleteInvoice(userId: string, invoiceId: string): Promise<void>
// Rejects if status !== 'draft'

duplicateInvoice(userId: string, invoiceId: string): Promise<Invoice>
// Copies all fields to new draft with new invoice number

transitionStatus(userId: string, invoiceId: string, newStatus: InvoiceStatus): Promise<Invoice>
// Enforces valid transitions: draft→sent, sent/viewed→paid; records timestamp

calculateTotals(lineItems: LineItem[]): InvoiceTotals
// Pure function: subtotal = sum(qty * unitPrice), taxTotal = sum(qty * unitPrice * taxRate/100), grandTotal = subtotal + taxTotal
// All values in integer cents
```

## PDFService

```typescript
generatePDF(userId: string, invoiceId: string): Promise<Buffer>
// Fetches invoice + client, renders PDFKit document to buffer, returns binary
```

## DashboardService

```typescript
getDashboardSummary(userId: string): Promise<DashboardSummary>
// Fetches all user invoices, computes all aggregations in-Lambda
```

## UserService

```typescript
getProfile(userId: string): Promise<UserProfile>
updateProfile(userId: string, req: UpdateProfileRequest): Promise<UserProfile>
// Validates invoicePrefix (alphanumeric, 1-10 chars)
```
