# Credential Compromise Response Procedure

**Classification**: Security Operations — Internal  
**Relates to**: NFR-03.10, SECURITY-12  
**Last Updated**: 2026-06-30

---

## Trigger Conditions

Initiate this procedure when ANY of the following are observed:

- JWT private key secret ARN has been accessed by an unexpected principal (visible in CloudTrail)
- Anomalous token usage: valid tokens from unexpected IPs or geographies at unusual times
- Multiple accounts simultaneously showing unexpected `sentAt`/`paidAt` mutations
- Source code or CI/CD pipeline compromise that may have exposed secrets
- Employee with Secrets Manager access departs under adverse circumstances
- AWS Security Hub or GuardDuty alert referencing the QuickInvoice AWS account

---

## Severity Classification

| Condition | Severity |
|---|---|
| Confirmed private key exfiltration | **P0 — Immediate** |
| Suspected key exposure (circumstantial) | **P1 — Urgent (within 2 hours)** |
| Precautionary rotation (policy breach, no evidence of exposure) | **P2 — Planned (within 24 hours)** |

---

## P0/P1 Immediate Response Steps

### Step 1 — Declare Incident (< 5 minutes)
1. Notify the on-call security contact and engineering lead immediately.
2. Open an incident channel (e.g. Slack `#incident-YYYYMMDD`).
3. Assign an Incident Commander (IC).

### Step 2 — Mass Token Revocation (< 10 minutes)
Invalidate all active sessions without waiting for key rotation:

```bash
# Increment tokenVersion for ALL users in DynamoDB
# This causes JWTAuthorizerLambda to reject all existing access tokens
# on their next API call, regardless of expiry.

aws dynamodb scan \
  --table-name quickinvoice-prod \
  --filter-expression "sk = :sk" \
  --expression-attribute-values '{":sk": {"S": "PROFILE"}}' \
  --projection-expression "pk" \
  --query "Items[].pk.S" \
  --output text | tr '\t' '\n' | while read pk; do
    aws dynamodb update-item \
      --table-name quickinvoice-prod \
      --key "{\"pk\":{\"S\":\"$pk\"},\"sk\":{\"S\":\"PROFILE\"}}" \
      --update-expression "ADD tokenVersion :inc" \
      --expression-attribute-values '{":inc":{"N":"1"}}'
  done
```

**Effect**: All existing access tokens are immediately rejected on next use.  
Refresh tokens in HttpOnly cookies will attempt refresh, which also checks tokenVersion — they will be rejected and users will be redirected to login.

### Step 3 — Rotate JWT Key Pair (< 15 minutes)

#### Option A: Automated (Secrets Manager Rotation Lambda)
```bash
aws secretsmanager rotate-secret \
  --secret-id arn:aws:secretsmanager:ap-southeast-2:921347857734:secret:quickinvoice/jwt-private-key \
  --rotate-immediately
```

Wait for rotation to complete:
```bash
aws secretsmanager describe-secret \
  --secret-id arn:aws:secretsmanager:ap-southeast-2:921347857734:secret:quickinvoice/jwt-private-key \
  --query "RotationRules"
```

#### Option B: Manual
```bash
# Generate new RSA-2048 key pair
openssl genrsa -out new-private.pem 2048
openssl rsa -in new-private.pem -pubout -out new-public.pem

# Update Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id quickinvoice/jwt-private-key \
  --secret-string file://new-private.pem

aws secretsmanager put-secret-value \
  --secret-id quickinvoice/jwt-public-key \
  --secret-string file://new-public.pem

# Securely delete local key files
shred -u new-private.pem new-public.pem
```

**RS256 advantage**: Because AuthLambda signs and JWTAuthorizerLambda verifies separately using the public key, new Lambda instances automatically pick up the new public key on cold-start or on next verify failure — **no coordinated redeployment needed** (NFR-03.8).

### Step 4 — Verify New Key Active
Issue a test login and confirm the new access token is accepted:
```bash
curl -X POST https://api.quickinvoice.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"<test-password>"}' \
  -c /tmp/cookies.txt
```

### Step 5 — Revoke Old Secret Version
After confirming new key works:
```bash
aws secretsmanager update-secret-version-stage \
  --secret-id quickinvoice/jwt-private-key \
  --version-stage AWSPREVIOUS \
  --remove-from-version-id <old-version-id>
```

### Step 6 — User Notification
If user data was accessed or there is evidence of unauthorised activity:
- Notify affected users via email within 72 hours (best practice, required if GDPR applies in future)
- Template: "We detected unusual activity on your QuickInvoice account. As a precaution, we have signed out all active sessions. Please log in again. No payment data was affected."

### Step 7 — Post-Incident Review (within 48 hours)
1. CloudTrail audit: which principals accessed the secret, when, from where
2. DynamoDB audit logs: which records were read/modified during the incident window
3. Root cause analysis document
4. Update this procedure with lessons learned
5. Consider: IAM policy tightening, additional CloudWatch alarms, VPC endpoint for Secrets Manager

---

## Scheduled Rotation Policy (Normal Operations)

- **Rotation schedule**: Every 90 days (automated via Secrets Manager rotation Lambda)
- **Rotation Lambda**: Generates new RSA-2048 key pair, stores new private key as `AWSCURRENT`, publishes new public key
- **Zero-downtime**: JWTAuthorizerLambda retries with refreshed public key on first verify failure (see `token-service.ts: getPublicKey(forceRefresh=true)`)
- **Monitoring**: CloudWatch alarm fires if rotation fails (Secrets Manager emits `RotationFailed` event)

---

## Key Contacts

| Role | Contact |
|---|---|
| Incident Commander | (define before launch) |
| Security Contact | (define before launch) |
| AWS Account Owner | (define before launch) |
