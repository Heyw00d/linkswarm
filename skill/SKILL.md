# Listing Swarm 🐝

**Automated directory submissions to the platforms LLMs actually cite.**

Most "submit to 200+ directories" services are wasting your time. 88% of AI Overview citations come from just 6 platforms. Listing Swarm focuses on what matters.

## The Problem

- Directory submission services brag about 200+ submissions
- Research shows AlternativeTo, SaaSHub, FinancesOnline = **0% LLM citations**
- G2, Capterra, Reddit, Crunchbase = **88% of all review citations**
- You're paying for backlink padding, not AI visibility

## What Listing Swarm Does

Submits your product to the **S-Tier platforms** that actually drive:
1. LLM citations (ChatGPT, Perplexity, Claude, Gemini)
2. AI Overview appearances
3. RAG retrieval inclusion
4. Training data presence

## Platform Tiers

### 🏆 S-Tier (We Submit Here)
| Platform | Why It Matters | Citation Share |
|----------|---------------|----------------|
| G2 | Most cited B2B review platform | 22-23% |
| Capterra | Claude's #1 review source | 47% ChatGPT |
| GetApp | Gartner ecosystem | Part of 88% |
| TrustRadius | Enterprise reviews | Part of 88% |
| Crunchbase | Company data source | ChatGPT primary |
| Product Hunt | DR91, Common Crawl | Parametric weight |
| Reddit | Perplexity's main source | 40% ALL citations |
| GitHub | Training data heavy | Parametric weight |

### 💀 B-Tier (We Skip These)
AlternativeTo, SaaSHub, FinancesOnline, BetaList, SiteJabber, PeerSpot, Indie Hackers, Slant, StackShare — **zero measured LLM citation impact**.

## Usage

### Quick Start
```bash
# Install dependencies
npm install puppeteer playwright

# Run submission for a site
node listing-swarm.js --site spendbase --tier s
```

### Configuration
Create `sites/{site-id}.json`:
```json
{
  "name": "Spendbase",
  "url": "https://spendbase.cards",
  "tagline": "Compare crypto credit cards and neo-banks",
  "description": "The definitive comparison of 100+ crypto credit cards...",
  "category": "fintech",
  "logo": "https://spendbase.cards/logo.png",
  "screenshots": ["https://..."],
  "pricing": "free",
  "contact": {
    "email": "hello@spendbase.cards",
    "twitter": "@spendbasecards"
  }
}
```

### Automation Levels
```bash
# Full auto (no human needed)
node listing-swarm.js --site spendbase --auto full

# Partial (preps submission, flags for human verification)
node listing-swarm.js --site spendbase --auto partial

# Manual (generates instructions only)
node listing-swarm.js --site spendbase --auto manual
```

## File Structure

```
listing-swarm/
├── SKILL.md              # This file
├── listing-swarm.js      # Main orchestrator
├── platforms/            # Platform-specific submitters
│   ├── g2.js
│   ├── capterra.js
│   ├── crunchbase.js
│   ├── producthunt.js
│   ├── reddit.js
│   └── github.js
├── sites/                # Site configurations
│   ├── spendbase.json
│   └── linkswarm.json
├── templates/            # Submission templates
│   ├── descriptions.md
│   └── reddit-posts.md
└── submissions.json      # Tracking log
```

## Submission Tracking

Each submission is logged:
```json
{
  "id": "sub_abc123",
  "site": "spendbase",
  "platform": "g2",
  "status": "pending",
  "submittedAt": "2026-02-09T15:00:00Z",
  "listingUrl": null,
  "notes": "Awaiting review approval"
}
```

## Platform Details

### G2 / Capterra / GetApp
- **Automation:** Manual (requires business verification)
- **Process:** Create vendor account → Claim/create listing → Add details
- **Timeline:** 1-2 weeks for approval
- **What we do:** Generate all content, guide through process

### Crunchbase
- **Automation:** Partial (form submission, human verification)
- **Process:** Create organization → Add product → Verify
- **Timeline:** 3-5 days
- **What we do:** Pre-fill all fields, submit, flag for verification

### Product Hunt
- **Automation:** Partial (schedule launch, human engagement needed)
- **Process:** Create upcoming page → Schedule launch → Engage
- **Timeline:** Plan 2 weeks ahead for good launch
- **What we do:** Create launch assets, schedule, provide engagement playbook

### Reddit
- **Automation:** Partial (needs aged accounts, human judgment)
- **Process:** Post to relevant subreddits with value-first content
- **Subreddits:** r/fintech, r/cryptocurrency, r/startups, r/SaaS
- **What we do:** Draft posts, identify best subreddits, time posts

### GitHub
- **Automation:** Full
- **Process:** Create/update README with rich product info
- **What we do:** Optimize README for LLM extraction

## Integration with LinkSwarm

Listing Swarm submissions automatically:
1. Register the site with LinkSwarm API
2. Create partner matches based on new platform presence
3. Track citation improvements via Citation Tracker

## Pricing

| Tier | What's Included | Price |
|------|-----------------|-------|
| Self-Service | Skill + templates + tracking | Free |
| Managed | We handle all submissions | $199 one-time |
| Premium | Managed + PH launch support | $499 one-time |

## Success Metrics

After Listing Swarm:
- [ ] Listed on G2 with 5+ reviews
- [ ] Crunchbase profile complete
- [ ] Product Hunt launched
- [ ] 3+ Reddit posts with engagement
- [ ] GitHub README optimized
- [ ] Measurable citation rate increase (via Citation Tracker)

## Resources

- [AI Citation Intel](/intel/) - Which platforms actually matter
- [Citation Tracker](/docs/citation-tracker-spec.md) - Measure your AI visibility
- [GEO Playbook](/blog/backlinks-ai-visibility/) - Full strategy guide
