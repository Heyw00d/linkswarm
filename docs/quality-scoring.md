# Quality Scoring

How LinkSwarm evaluates site quality — and why you can trust our network.

---

## Network Quality Guarantee

LinkSwarm is **not a PBN** (Private Blog Network). We enforce strict quality standards:

✅ **Every site is verified** — Domain ownership confirmed via DNS or meta tag  
✅ **Automated quality analysis** — Real traffic and ranking data, not self-reported  
✅ **Third-party metrics** — We use DataForSEO (same data as Semrush/Ahrefs)  
✅ **Spam detection** — Low-quality sites are flagged and limited  
✅ **Transparent scoring** — You see every partner's quality score before matching  

---

## Quality Score (0-100)

Every site in LinkSwarm gets a **Quality Score** that affects:
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

## Third-Party Data Sources

### What We Use: DataForSEO

LinkSwarm uses **DataForSEO** — the same underlying data that powers Semrush, Ahrefs, and other major SEO tools.

When you analyze a site, we fetch:
- **Estimated Traffic Value (ETV)** — Monthly organic traffic value in USD
- **Ranking Keywords** — Total keywords the site ranks for
- **Top 10 Positions** — Keywords ranking on page 1
- **Top 3 Positions** — Keywords in top 3 spots

This is **real data**, not self-reported. Sites can't inflate their scores.

### Why Not Ahrefs/Moz Directly?

| Tool | DR/DA Range | Our Equivalent |
|------|-------------|----------------|
| Ahrefs DR | 0-100 | Quality Score 0-100 |
| Moz DA | 0-100 | Quality Score 0-100 |
| Semrush AS | 0-100 | Quality Score 0-100 |

Our score correlates with these industry-standard metrics. A site with Quality Score 70+ will typically have:
- Ahrefs DR: 40+
- Moz DA: 45+
- Real organic traffic

### Verify Partners Yourself

Before accepting a match, you can check partners independently:

| Tool | What to Check | Link |
|------|---------------|------|
| **Ahrefs** | Domain Rating, Backlink profile | [Free checker](https://ahrefs.com/website-authority-checker) |
| **Moz** | Domain Authority, Spam Score | [Link Explorer](https://moz.com/link-explorer) |
| **Semrush** | Authority Score, Traffic | [Domain Overview](https://www.semrush.com/analytics/overview/) |
| **Ubersuggest** | DA, Monthly traffic | [Free tool](https://neilpatel.com/ubersuggest/) |
| **Google** | Index status, Site quality | `site:domain.com` search |

### Bring Your Own Ahrefs (Coming Soon)

Pro and Agency users can connect their Ahrefs API key for enhanced metrics:

```bash
# Connect your Ahrefs API key
curl -X PATCH https://api.linkswarm.ai/v1/settings \
  -H "Authorization: Bearer sk_..." \
  -d '{"ahrefs_api_key": "your_ahrefs_key"}'
```

Once connected, you get:
- **Domain Rating (DR)** — Industry-standard authority metric
- **Backlink Profile** — Total backlinks, referring domains
- **Spam Detection** — Identify PBN/link farm patterns
- **Traffic Estimates** — Ahrefs organic traffic data

Your Ahrefs key is encrypted and only used for your own sites.

### Google Search Console Integration (Coming Soon)

Connect your GSC to prove LinkSwarm is working:

- **Backlink verification** — See when Google detects our placements
- **Ranking impact** — Track position changes after links
- **Traffic attribution** — Clicks gained from new backlinks
- **ROI dashboard** — Prove the value to your team

```bash
# Connect GSC (OAuth)
POST /v1/integrations/gsc/connect

# Get backlink impact report
GET /v1/analytics/backlink-impact
```

This is real Google data — the ultimate proof that your backlinks work.

### API Access to Scores

All quality data is available via API:

```bash
# Get partner quality before accepting
curl https://api.linkswarm.ai/v1/discover?categories=crypto \
  -H "Authorization: Bearer sk_..."
```

Response includes quality metrics:
```json
{
  "matches": [
    {
      "domain": "cryptonews.com",
      "quality_score": 78,
      "etv": 125000,
      "keywords": 8500,
      "top10": 920,
      "relevance_score": 0.85
    }
  ]
}
```

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

## Network Quality Controls

LinkSwarm enforces quality at every level:

### Matching Rules
- **Similar tiers match** — Premium sites match with other premium sites
- **Quality bonus** — Higher-quality contributions earn bonus credits
- **Relevance required** — Semantic matching ensures topical relevance

### Anti-Spam Measures
- **Auto-reject threshold** — Sites below score 20 are blocked
- **Velocity limits** — Max 4-10 links/week (natural growth)
- **Reciprocal blocks** — No A↔B exchanges for 90 days
- **Link verification** — Crawler confirms every placement

### Continuous Monitoring
- **Weekly re-verification** — Links are checked to ensure they're still live
- **Quality re-analysis** — Scores update as sites grow or decline
- **Reputation tracking** — Sites that remove links lose reputation

### Result: A Clean Network

Unlike PBNs or shady link farms, LinkSwarm maintains:

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Average Quality Score | 50+ | Only real sites with traffic |
| Spam Rate | <2% | Automated detection + manual review |
| Link Survival | 95%+ | Verified placements stay live |
| Relevance Match | 70%+ | Contextual, not random links |

**Your backlinks look natural to Google** because they *are* natural — real sites linking to real content.
