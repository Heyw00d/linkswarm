# AI Citation Tracker - MVP Specification

## Overview

Track when and where LLMs cite your domain. The killer feature that standalone tools charge $75K-$150K/year for.

## Core Concept

When users ask ChatGPT, Perplexity, Claude, or Gemini questions related to your product/industry:
- Does your brand get mentioned?
- What sources get cited instead?
- How does your "AI share of voice" compare to competitors?

## MVP Scope (4-6 weeks)

### Phase 1: Query Monitoring (Week 1-2)

**What we build:**
- Define 10-50 "monitoring queries" per registered site
- Queries based on: product category, competitor names, use-case keywords
- Example for Spendbase: "best crypto credit cards", "USDC debit cards", "compare Coinbase card vs..."

**Data model:**
```json
{
  "siteId": "spendbase",
  "queries": [
    {
      "query": "best crypto credit cards 2026",
      "category": "primary",
      "competitors": ["coinbase", "crypto.com", "fold"]
    }
  ],
  "schedule": "daily"
}
```

### Phase 2: LLM Response Collection (Week 2-3)

**What we build:**
- Automated queries to ChatGPT, Perplexity, Claude, Gemini APIs
- Parse responses for:
  - Brand mentions (exact match + fuzzy)
  - Source citations (URLs)
  - Sentiment around mentions
  - Position in response (first mention vs buried)

**Response storage:**
```json
{
  "queryId": "q_abc123",
  "timestamp": "2026-02-09T15:00:00Z",
  "engine": "perplexity",
  "response": "...",
  "mentions": [
    {
      "brand": "spendbase",
      "context": "Spendbase offers a comparison of...",
      "position": 2,
      "sentiment": "neutral"
    }
  ],
  "citations": [
    {
      "url": "https://spendbase.cards/...",
      "anchor": "crypto card comparison"
    }
  ]
}
```

### Phase 3: Dashboard & Analytics (Week 3-4)

**Metrics to display:**
1. **Citation Rate** - % of queries where your brand was cited
2. **AI Share of Voice** - Your mentions vs competitor mentions
3. **Citation Sources** - Which of YOUR pages get cited most
4. **Engine Breakdown** - Performance by ChatGPT/Perplexity/Claude/Gemini
5. **Trend Over Time** - Are citations increasing as you build links?

**Dashboard mockup sections:**
- Overall score: "Your AI Visibility Score: 34/100"
- Competitor comparison chart
- Recent citations feed
- Query performance table
- Recommendations ("Add more content about X - competitors getting cited for this")

### Phase 4: LinkSwarm Correlation (Week 4-5)

**The differentiator:**
- Correlate backlink activity with citation changes
- "You got 5 new backlinks from AI directories → Citation rate +12%"
- Show which link partnerships drove citation improvements
- This closes the loop: Links → Citations → Proof

## Technical Architecture

### API Costs (Estimates)
- Perplexity: $5/1000 queries (they have a search API)
- ChatGPT: ~$0.01-0.03 per query (GPT-4)
- Claude: ~$0.01 per query
- Gemini: Free tier available

**Per-site monthly cost (50 queries × 4 engines × 30 days):**
- ~6000 API calls/month
- ~$30-100/site/month in API costs
- Charge $99-299/month for the feature

### Data Pipeline
```
Cron (daily) 
  → Query each LLM for each monitoring query
  → Parse responses (brand detection, citation extraction)
  → Store in Neon DB
  → Calculate daily metrics
  → Update dashboard
```

### Existing Infrastructure
- Neon DB (already using)
- Cloudflare Workers (already using)
- Dashboard (already built)

## Pricing Model

| Tier | Queries/Month | Engines | Price |
|------|---------------|---------|-------|
| Starter | 100 | 2 (Perplexity, ChatGPT) | Included in Pro ($29) |
| Pro | 500 | 4 | $99/mo add-on |
| Agency | 2000 | 4 + custom | $299/mo add-on |

## MVP Success Metrics

1. Can track 3+ sites with 50+ queries each
2. Dashboard shows meaningful citation data within 7 days
3. Users can see correlation between LinkSwarm activity and citations
4. At least one "aha moment" screenshot for marketing

## Competitive Advantage

- **Profound**: $75K-$150K/year, enterprise only
- **Brand24 AI Monitoring**: $399/mo, limited LLM coverage
- **LinkSwarm**: $99-299/mo, integrated with link building

We're the only tool that connects **link building → AI citations** in one platform.

## Open Questions

1. Rate limits on LLM APIs for automated queries?
2. Legal considerations for automated LLM querying?
3. How to handle LLM response variability (same query, different answers)?
4. Brand detection accuracy (fuzzy matching, synonyms)?

## Next Steps

1. [ ] Set up Perplexity API access (they have the best citation data)
2. [ ] Build query management UI in dashboard
3. [ ] Create response parser for brand/citation extraction
4. [ ] Design citation analytics dashboard
5. [ ] Beta test with Spendbase + LinkSwarm as first sites
