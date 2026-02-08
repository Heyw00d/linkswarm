# LinkSwarm Best Practices

Guidelines for safe, effective backlink building with LinkSwarm.

---

## 🔐 Security

### API Key Management
- **Never commit keys to git** — use environment variables or secret managers
- **Rotate keys periodically** — `POST /rotate-key` generates a new key
- **One key per application** — don't share keys across projects

```bash
# Good: Environment variable
export LINKSWARM_API_KEY="sk_linkswarm_..."

# Good: Secret manager
linkswarm_key=$(aws secretsmanager get-secret-value --secret-id linkswarm)
```

### Webhook Security (Future)
When webhooks are available:
- Verify webhook signatures
- Use HTTPS endpoints only
- Implement replay protection with timestamp checks

---

## 📊 Link Velocity

### Start Slow
New sites should limit link acquisition:

| Site Age | Recommended Pace |
|----------|------------------|
| < 3 months | 1-2 links/week |
| 3-12 months | 2-4 links/week |
| 1+ year (established) | 4-8 links/week |

LinkSwarm enforces velocity limits, but staying conservative is safer.

### Natural Patterns
- **Vary timing** — don't request links at the same time daily
- **Mix anchor text** — use variations, not exact match every time
- **Diversify sources** — the system enforces max 10% from single source

---

## 🎯 Content Strategy

### Best Pages to Contribute
Good candidates for outbound link slots:
- Resource pages ("Top 10...", "Best tools for...")
- Blog posts with external references
- Guides that naturally cite sources
- Comparison pages

**Avoid contributing:**
- Homepage
- Product/pricing pages
- Pages with no existing outbound links

### Best Pages to Target
Request links to:
- Cornerstone content (comprehensive guides)
- Product pages with unique value
- Data/research you've published
- Tools that solve problems

**Avoid targeting:**
- Thin content pages
- Pages with high bounce rate
- Duplicate content

---

## 🏷️ Anchor Text

### Diversify Your Anchors
Don't request the same anchor repeatedly:

```
❌ Bad (over-optimized):
"best crypto card" → 10 links
"best crypto card" → 10 links

✅ Good (natural mix):
"crypto card comparison" → 3 links
"compare crypto cards" → 2 links
"this guide" → 2 links
"spendbase.cards" → 2 links (brand)
"click here" → 1 link (generic)
```

### Anchor Distribution
Aim for roughly:
- 30-40% partial match ("guide to crypto cards")
- 20-30% brand name ("SpendBase")
- 20-30% generic ("read more", "this article")
- 10-20% exact match ("best crypto card")

---

## 🔄 Credit Management

### Maintain Positive Balance
- Contribute before requesting
- Monitor credits via `GET /v1/pool/status`
- Set alerts when credits drop low

### Maximize Credit Value
- Contribute from high-authority pages (earns bonus credits)
- Request links to your most important pages
- Quality over quantity

---

## 🚫 What NOT to Do

### Avoid These Patterns
- **PBN-style sites** — low-quality sites created just for links
- **Keyword-stuffed anchors** — "best cheap crypto card buy now"
- **Link velocity spikes** — 50 links one week, 0 the next
- **Footer/sidebar links** — contextual body links only
- **Reciprocal schemes** — the system blocks these, but don't try to game it

### Penalties
LinkSwarm enforces network integrity:
- Links removed → reputation penalty
- Gaming detected → account suspension
- Spam sites → permanent ban

---

## 📈 Monitoring

### Track Your Progress
- **Domain Authority** — check monthly with Moz/Ahrefs
- **Referring domains** — should grow steadily
- **Organic traffic** — Google Search Console
- **Link health** — `GET /v1/pool/status` for verified/broken

### Red Flags to Watch
- Sudden DA drop
- Google Search Console warnings
- Links from irrelevant sites (semantic matching should prevent this)

---

## 🤖 Agent Integration

### For AI Agents
If you're building an autonomous agent:

1. **Respect rate limits** — implement exponential backoff
2. **Log everything** — audit trail for link decisions
3. **Human oversight** — alert on unusual patterns
4. **Graceful degradation** — handle API downtime

```python
# Good agent pattern
class LinkSwarmAgent:
    def __init__(self, client):
        self.client = client
        self.max_daily_actions = 10
        self.actions_today = 0
    
    def should_act(self):
        if self.actions_today >= self.max_daily_actions:
            return False
        # Add more checks: time of day, credit balance, etc.
        return True
    
    def request_link(self, target):
        if not self.should_act():
            logging.info("Skipping action: daily limit reached")
            return
        
        result = self.client.request_link(target)
        self.actions_today += 1
        logging.info(f"Requested link to {target}: {result}")
        return result
```

---

## ✅ Checklist

Before going live:

- [ ] API key stored securely (not in code)
- [ ] Site verified (DNS or meta tag)
- [ ] Semantic analysis enabled
- [ ] Contributed at least 3-5 pages
- [ ] Anchor text variations prepared
- [ ] Monitoring set up (GSC, Ahrefs/Moz)
- [ ] Velocity limits configured
- [ ] Error handling implemented

---

## 📚 Resources

- [Protocol Spec](/docs/protocol.md)
- [API Schema](/docs/api/schema.json)
- [SDK Examples](/docs/sdk-examples.md)
- [Verification Guide](/docs/verification.md)
