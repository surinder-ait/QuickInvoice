# QuickInvoice

Invoice management platform for freelancers. Create professional invoices in seconds, track payments, get paid faster.

## Tech Stack

- **Backend**: TypeScript / Node.js 20 on AWS Lambda
- **API**: AWS API Gateway (REST) with RS256 JWT Authorizer
- **Database**: AWS DynamoDB (single-table design)
- **Email**: AWS SES
- **Secrets**: AWS Secrets Manager (RS256 key pair)
- **Frontend**: Plain HTML5 / CSS3 / Vanilla JS on S3 + CloudFront
- **PDF**: PDFKit (server-side, on-demand)
- **IaC**: AWS SAM

## Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli` or see [SAM docs](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- An AWS account with SES domain verified

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local.json
# Edit .env.local.json with your values

# 3. Build TypeScript
npm run build

# 4. Start local API (requires Docker for SAM local)
sam local start-api --env-vars .env.local.json
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `DYNAMODB_TABLE_NAME` | DynamoDB table name (e.g. `quickinvoice-dev`) |
| `JWT_PRIVATE_KEY_SECRET_ARN` | Secrets Manager ARN for RS256 private key |
| `JWT_PUBLIC_KEY_SECRET_ARN` | Secrets Manager ARN for RS256 public key |
| `SES_FROM_ADDRESS` | Verified SES sender email |
| `APP_BASE_URL` | Base URL for email links (e.g. `https://app.quickinvoice.com`) |

## Generating JWT Key Pair (First-Time Setup)

```bash
# Generate RSA-2048 key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Store in Secrets Manager
aws secretsmanager create-secret \
  --name quickinvoice/jwt-private-key \
  --secret-string file://private.pem

aws secretsmanager create-secret \
  --name quickinvoice/jwt-public-key \
  --secret-string file://public.pem

# Delete local copies
shred -u private.pem public.pem
```

## Running Tests

```bash
# Unit tests (includes property-based tests)
npm run test:unit

# Integration tests (requires deployed/local API)
npm run test:integration

# All tests with coverage
npm run test:coverage
```

## Deployment

```bash
# Deploy to dev
make deploy-dev

# Deploy to prod
make deploy-prod
```

## Security

- JWT uses RS256 asymmetric signing (rotate key without redeployment)
- Passwords hashed with bcrypt (cost factor 12)
- All sessions invalidated on password reset
- Mass revocation via `tokenVersion` counter in DynamoDB
- All secrets stored in AWS Secrets Manager — never in source code or environment variables
- See [docs/credential-compromise-procedure.md](docs/credential-compromise-procedure.md) for incident response

## Project Structure

```
src/
  auth/         JWT auth, token service, brute-force protection
  clients/      Client CRUD
  invoices/     Invoice lifecycle + financial calculations
  pdf/          On-demand PDF generation
  dashboard/    Analytics aggregations
  shared/       DynamoDB client, types, validation, logger, error handler
frontend/
  css/          Styles
  js/           API client, page scripts
  *.html        Pages
tests/
  unit/         Jest + fast-check property-based tests
  integration/  API integration tests
docs/
  credential-compromise-procedure.md
template.yaml   AWS SAM infrastructure
```
