# QuickInvoice — Unit of Work Story Map

## Unit: auth
| Story | Description |
|---|---|
| AUTH-01 | As a freelancer, I can register with email and password so I can access the platform |
| AUTH-02 | As a freelancer, I must verify my email before I can log in |
| AUTH-03 | As a freelancer, I can log in with my email and password |
| AUTH-04 | As a freelancer, I can log out and have my session invalidated |
| AUTH-05 | As a freelancer, I can request a password reset email |
| AUTH-06 | As a freelancer, I can reset my password via the emailed link |
| AUTH-07 | As a freelancer, my session is silently refreshed so I don't get logged out unexpectedly |
| AUTH-08 | As a security requirement, all JWTs use RS256 with automated key rotation |
| AUTH-09 | As a security requirement, a mass revocation procedure exists for credential compromise |

## Unit: clients
| Story | Description |
|---|---|
| CLI-01 | As a freelancer, I can add a client with their name and email |
| CLI-02 | As a freelancer, I can view a list of all my clients |
| CLI-03 | As a freelancer, I can edit a client's name and email |
| CLI-04 | As a freelancer, I can delete a client (invoices are retained) |

## Unit: invoices
| Story | Description |
|---|---|
| INV-01 | As a freelancer, I can create an invoice for a client with line items (desc, qty, price, tax) |
| INV-02 | As a freelancer, invoice totals are calculated automatically (subtotal, tax, grand total) |
| INV-03 | As a freelancer, invoice numbers are auto-assigned with my configurable prefix |
| INV-04 | As a freelancer, I can view a list of all my invoices with their status |
| INV-05 | As a freelancer, I can edit a draft invoice |
| INV-06 | As a freelancer, I can delete a draft invoice |
| INV-07 | As a freelancer, I can duplicate an invoice to create a new draft |
| INV-08 | As a freelancer, I can mark an invoice as sent |
| INV-09 | As a freelancer, I can mark an invoice as paid |
| INV-10 | As a freelancer, sent/paid invoices cannot be edited (immutable) |

## Unit: pdf
| Story | Description |
|---|---|
| PDF-01 | As a freelancer, I can download a PDF of any invoice |
| PDF-02 | The PDF uses a professional fixed template with all invoice fields and line items |

## Unit: dashboard
| Story | Description |
|---|---|
| DASH-01 | As a freelancer, I can see my total outstanding amount on the dashboard |
| DASH-02 | As a freelancer, I can see overdue invoices and their total |
| DASH-03 | As a freelancer, I can see revenue for this month and this year |
| DASH-04 | As a freelancer, I can see my recent invoice activity (last 10) |
| DASH-05 | As a freelancer, I can see my top 5 clients by revenue |
| DASH-06 | As a freelancer, I can see my average payment time |

## Unit: frontend
| Story | Description |
|---|---|
| FE-01 | As a freelancer, I can use a web UI to complete all platform actions |
| FE-02 | As a freelancer, the UI shows live invoice total preview as I enter line items |
| FE-03 | As a freelancer, the dashboard shows charts for revenue and client metrics |
| FE-04 | As a freelancer, the UI meets WCAG 2.1 AA accessibility requirements |
