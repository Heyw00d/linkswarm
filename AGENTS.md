# LinkSwarm Agent Integration Guide

This guide is for AI agents integrating with LinkSwarm's backlink network.

## Overview

LinkSwarm uses a **network pool model**, not direct exchanges:
- You contribute link slots to the pool
- You request links from the pool
- Algorithm distributes non-reciprocally (no A↔B patterns)
- Links look natural to search engines

## API Reference

**Base URL**: `https://api.linkswarm.ai`

**Authentication**: All requests require:
```
Authorization: Bearer sk_linkswarm_your_api_key
```

---

## Step 1: Get an API Key

### Sign Up
```bash
POST /waitlist
Content-Type: application/json

{"email": "agent@yoursite.com", "source": "agent"}
```

Response:
```json
{"success": true, "verified": false, "message": "Verification code sent"}
```

### Verify Email
```bash
POST /verify-email
Content-Type: application/json

{"email": "agent@yoursite.com", "code": "123456"}
```

Response:
```json
{"success": true, "apiKey": "sk_linkswarm_..."}
```

---

## Step 2: Register Your Site

```bash
POST /v1/sites
Authorization: Bearer sk_linkswarm_...
Content-Type: application/json

{
  "domain": "yoursite.com",
  "name": "Your Site Name",
  "description": "What your site is about",
  "categories": ["crypto", "fintech", "defi"]
}
```

Response:
```json
{
  "success": true,
  "domain": "yoursite.com",
  "verification_token": "verify_abc123...",
  "verification_methods": {
    "dns": "Add TXT record: linkswarm-verify=verify_abc123...",
    "meta": "Add to <head>: <meta name=\"linkswarm-verify\" content=\"verify_abc123...\">"
  }
}
```

### Verify Ownership
```bash
POST /v1/sites/verify
Authorization: Bearer sk_linkswarm_...
Content-Type: application/json

{"domain": "yoursite.com"}
```

---

## Step 3: Analyze for Semantic Matching

This enables AI-powered relevance matching:

```bash
POST /v1/sites/analyze
Authorization: Bearer sk_linkswarm_...
Content-Type: application/json

{"domain": "yoursite.com"}
```

Response:
```json
{
  "success": true,
  "domain": "yoursite.com",
  "title": "Your Site",
  "description": "Extracted description...",
  "has_embedding": true,
  "message": "Site analyzed! Semantic matching enabled."
}
```

---

## Step 4: Contribute to the Pool

Offer pages where you'll place outbound links:

```bash
POST /v1/pool/contribute
Authorization: Bearer sk_linkswarm_...
Content-Type: application/json

{
  "domain": "yoursite.com",
  "page": "/blog/crypto-guide",
  "max_links": 2,
  "categories": ["crypto", "defi"],
  "context": "Resource section at end of article"
}
```

This earns you **link credits** to request links back.

---

## Step 5: Request Links

Request links to your pages:

```bash
POST /v1/pool/request
Authorization: Bearer sk_linkswarm_...
Content-Type: application/json

{
  "domain": "yoursite.com",
  "target_page": "/products/card",
  "preferred_anchor": "best crypto card",
  "categories": ["crypto", "fintech"]
}
```

Algorithm will match you with relevant sites (non-reciprocally).

---

## Step 6: Check Status

```bash
GET /v1/pool/status
Authorization: Bearer sk_linkswarm_...
```

Response:
```json
{
  "credits_available": 5,
  "credits_contributed": 8,
  "pending_placements": [
    {"from": "othersite.com", "to_page": "/products/card", "status": "pending"}
  ],
  "links_given": [...],
  "links_received": [...]
}
```

---

## Discovery (Find Relevant Sites)

```bash
GET /v1/discover?domain=yoursite.com&limit=10
Authorization: Bearer sk_linkswarm_...
```

Response:
```json
{
  "count": 5,
  "matches": [
    {
      "domain": "relevantsite.com",
      "relevance_score": 0.85,
      "match_reason": ["High content similarity", "Shared categories: crypto"],
      "categories": ["crypto", "defi"]
    }
  ],
  "semantic_matching": true
}
```

---

## Dashboard Data

```bash
GET /dashboard
Authorization: Bearer sk_linkswarm_...
```

Returns: plan, limits, sites, recent activity, upgrade URLs.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /waitlist | 10/min per IP |
| /verify-email | 10/min per IP |
| All authenticated | Based on plan |

Headers returned:
- `X-RateLimit-Remaining`: Requests left in window

---

## Plan Limits

| Plan | Sites | Links/Month | API Requests/Day |
|------|-------|-------------|------------------|
| Free | 3 | 25 | 100 |
| Pro ($29) | 10 | 100 | 1,000 |
| Agency ($99) | Unlimited | Unlimited | 100,000 |

---

## Important: Anti-Pattern Rules

LinkSwarm enforces these to keep links Google-safe:

1. **No reciprocal within 90 days**: If A→B exists, B→A is blocked
2. **Max 2 links per pair per year**: Even non-reciprocal
3. **Semantic relevance required**: Sites must share categories or content similarity
4. **Natural velocity**: Max 1-2 links placed per site per week
5. **Contextual only**: Links in content, not footers/sidebars

---

## Error Handling

All errors return JSON:
```json
{"error": "Error message here"}
```

Common status codes:
- `400` — Invalid input
- `401` — Missing or invalid API key
- `403` — Plan limit reached
- `404` — Resource not found
- `429` — Rate limited
- `500` — Server error

---

## Support

- Docs: https://linkswarm.ai/docs/
- FAQ: https://linkswarm.ai/faq/
- X/Twitter: https://x.com/Link_Swarm
