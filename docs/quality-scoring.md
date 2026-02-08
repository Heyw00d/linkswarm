# Quality Scoring

How LinkSwarm evaluates site quality for matching.

---

## Overview

Every site in LinkSwarm gets a **Quality Score** (0-100) that affects:
- Match priority (higher scores match first)
- Auto-accept/reject thresholds
- Network trust and reputation

---

## How Scores Are Calculated

When you run `POST /v1/sites/analyze`, we fetch metrics and calculate your score:

### Metrics We Use

| Metric | Source | Weight |
|--------|--------|--------|
| **ETV** (Estimated Traffic Value) | DataForSEO | 30% |
| **Ranking Keywords** | DataForSEO | 25% |
| **Top 10 Rankings** | DataForSEO | 15% |
| **Base Score** | Default | 30% |

### Scoring Formula

```
Base Score: 30 points

ETV Scoring (0-30 points):
  > $100K/mo  → +30
  > $10K/mo   → +25
  > $1K/mo    → +20
  > $100/mo   → +10
  > $0        → +5

Keywords Scoring (0-25 points):
  > 10,000    → +25
  > 1,000     → +20
  > 100       → +15
  > 10        → +10
  > 0         → +5

Top 10 Rankings (0-15 points):
  > 1,000     → +15
  > 100       → +10
  > 10        → +5

Quality Score = Sum of all (max 100)
```

---

## Quality Tiers

| Score | Tier | Meaning |
|-------|------|---------|
| 75-100 | 🥇 Premium | High-traffic, established sites |
| 50-74 | 🥈 Standard | Growing sites with decent traffic |
| 30-49 | 🥉 Basic | New or low-traffic sites |
| 0-29 | ⚠️ Low | May be auto-rejected by partners |

---

## Using Quality Filters

Set thresholds for incoming matches:

```bash
curl -X PATCH https://api.linkswarm.ai/v1/quality-settings \
  -H "Authorization: Bearer sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "min_quality_score": 40,
    "auto_accept_above": 75,
    "auto_reject_below": 25
  }'
```

### Filter Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `min_quality_score` | 30 | Minimum score to accept |
| `auto_accept_above` | 75 | Auto-accept without review |
| `auto_reject_below` | 20 | Auto-reject without review |
| `min_etv` | 0 | Minimum traffic value |

---

## Third-Party Tools

We use **DataForSEO** for automated quality metrics. You can also verify independently:

### Ahrefs
- **Domain Rating (DR)** — Site authority (0-100)
- **Organic Traffic** — Monthly search visits
- https://ahrefs.com/website-authority-checker

### Moz
- **Domain Authority (DA)** — Ranking potential (0-100)
- https://moz.com/domain-analysis

### Semrush
- **Authority Score** — Combined quality metric
- https://www.semrush.com/analytics/overview/

### Free Options
- **Google Search Console** — Your own site's performance
- **Ubersuggest** — Free DA checker
- https://neilpatel.com/ubersuggest/

---

## Improving Your Score

1. **Create quality content** — More indexed pages = more keywords
2. **Build organic backlinks** — Increases authority signals
3. **Improve site speed** — Better UX = better rankings
4. **Re-analyze periodically** — `POST /v1/sites/analyze` updates your score

---

## API Response

After analysis, your site includes:

```json
{
  "domain": "yoursite.com",
  "quality": {
    "score": 65,
    "etv": 2500,
    "keywords": 340,
    "top10": 45
  },
  "tier": "standard"
}
```

---

## Fair Matching

LinkSwarm uses quality scores to ensure fair exchanges:

- **Similar tiers match** — Premium sites match with other premium sites
- **Quality bonus** — Higher-quality contributions earn more credits
- **Spam prevention** — Low-quality sites have limited matching

This keeps the network valuable for everyone.
