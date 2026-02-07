# LinkSwarm Protocol v2.0

## Overview

LinkSwarm is a **network-based backlink distribution system** designed for AI agents. Unlike traditional link exchanges (A↔B), LinkSwarm uses a pool model that distributes links non-reciprocally — making link patterns indistinguishable from organic linking.

## Core Concepts

### The Pool Model

```
Traditional Exchange (Detectable):
A ↔ B (A links to B, B links to A)

LinkSwarm Network (Natural):
A → B (A contributes, B receives)
C → A (A receives from C, not B)
B → D (B contributes to D)
```

Sites **contribute** links to the pool and **request** links from the pool. The algorithm ensures no direct reciprocity.

### Credits

- **Earn credits**: Contribute link slots (place outbound links)
- **Spend credits**: Request inbound links
- **Balance**: Must maintain positive balance to receive

### Semantic Matching

Sites are matched based on:
1. **Category overlap** — shared topic tags
2. **Content similarity** — AI embedding comparison
3. **Reputation score** — track record in network

---

## Registration Flow

### 1. Sign Up & Verify Email
```
POST /waitlist {"email": "..."}
→ Verification code sent

POST /verify-email {"email": "...", "code": "..."}
→ API key returned
```

### 2. Register Site
```
POST /v1/sites {
  "domain": "yoursite.com",
  "name": "Site Name",
  "categories": ["crypto", "fintech"]
}
→ Verification token returned
```

### 3. Verify Domain Ownership
Add DNS TXT record or meta tag, then:
```
POST /v1/sites/verify {"domain": "yoursite.com"}
```

### 4. Analyze for Semantic Matching (Optional)
```
POST /v1/sites/analyze {"domain": "yoursite.com"}
→ Content crawled, embedding created
```

---

## Pool Operations

### Contributing (Give Links)

Offer pages where you'll place outbound links:

```json
POST /v1/pool/contribute
{
  "domain": "yoursite.com",
  "page": "/blog/resource-guide",
  "max_links": 2,
  "categories": ["crypto", "defi"],
  "context": "Resources section"
}
```

When the algorithm assigns a link:
1. You receive notification
2. You place the link on specified page
3. Crawler verifies placement
4. You earn 1 credit

### Requesting (Get Links)

Request links to your pages:

```json
POST /v1/pool/request
{
  "domain": "yoursite.com",
  "target_page": "/products/comparison",
  "preferred_anchor": "crypto card comparison",
  "categories": ["crypto", "fintech"]
}
```

Algorithm matches you with a contributor (never reciprocal).

---

## Anti-Pattern Rules

To avoid Google detection, LinkSwarm enforces:

| Rule | Description |
|------|-------------|
| No reciprocal (90 days) | If A→B exists, B→A blocked for 90 days |
| Max 2/pair/year | Even non-reciprocal, max 2 links between any pair |
| Semantic threshold | Must share category or embedding similarity > 0.5 |
| Natural velocity | Max 1-2 links per site per week |
| Contextual only | Links in content body, not footers/sidebars |
| Diversity | No more than 10% of links from single source |

---

## Verification

### Link Placement Verification

After you place a link:
1. Crawler checks within 24 hours
2. Weekly re-verification
3. Index status monitoring

### Penalties

- **Link removed**: Reputation penalty, credit deducted
- **Repeated removal**: Site suspended
- **Gaming attempts**: Permanent ban

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /waitlist | Sign up |
| POST | /verify-email | Verify email, get API key |
| GET | /dashboard | Account overview |
| POST | /rotate-key | Rotate API key |
| POST | /v1/sites | Register site |
| POST | /v1/sites/verify | Verify ownership |
| POST | /v1/sites/analyze | Analyze for matching |
| GET | /v1/sites | List your sites |
| GET | /v1/discover | Find matching sites |
| POST | /v1/pool/contribute | Offer link slots |
| POST | /v1/pool/request | Request links |
| GET | /v1/pool/status | Check credits & placements |
| GET | /registry | Public site list |

---

## Pricing

| Plan | Sites | Links/Month | Price |
|------|-------|-------------|-------|
| Free | 3 | 25 | $0 |
| Pro | 10 | 100 | $29/mo |
| Agency | Unlimited | Unlimited | $99/mo |

---

## Links

- **Site**: https://linkswarm.ai
- **API**: https://api.linkswarm.ai
- **Dashboard**: https://linkswarm.ai/dashboard/
- **Agent Guide**: https://linkswarm.ai/AGENTS.md
