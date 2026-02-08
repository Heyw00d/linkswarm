# AI Content Generation

> **Live!** Available for Pro and Agency plans.

AI-generated articles and images for your link placements.

---

## Overview

Need content for a link slot but don't have time to write? **AI Content** generates:

- 📝 **Articles** — 800+ word SEO-optimized content
- 🖼️ **Images** — Unique AI-generated visuals
- 🔗 **Natural Links** — Your backlink woven in contextually

Perfect for partners who have link slots but need content to fill them.

---

## How It Works

```
1. Partner offers a link slot
2. You request AI content for the topic
3. AI generates article + images
4. Partner reviews and approves
5. Content published → Credits awarded
```

---

## What You Get

### Article Generation

```
Input:
- Topic: "Best crypto debit cards 2026"
- Target link: spendbase.cards
- Anchor text: "compare crypto cards"
- Word count: 800-1200
- Style: informative

Output:
- SEO-optimized article
- Natural backlink placement
- Headers, bullet points, structure
- Meta description included
```

### Image Generation

```
Input:
- Topic: crypto debit cards
- Style: professional, modern
- Count: 3 images

Output:
- Hero image (1200x630)
- In-content images (800x600)
- Alt text included
- Unique, not stock photos
```

---

## API

```bash
# Generate content for a placement
POST /v1/content/generate
{
  "topic": "Best crypto debit cards comparison",
  "target_url": "https://spendbase.cards",
  "anchor_text": "compare crypto cards",
  "word_count": 1000,
  "style": "informative",
  "include_images": true,
  "image_count": 3
}

# Response
{
  "content_id": "cnt_abc123",
  "status": "generating",
  "estimated_time": "2 minutes"
}

# Get generated content
GET /v1/content/{content_id}
{
  "title": "The Complete Guide to Crypto Debit Cards in 2026",
  "body": "...(markdown with natural backlink)...",
  "meta_description": "Compare the best crypto debit cards...",
  "images": [
    {
      "url": "https://cdn.linkswarm.ai/img/abc123-1.png",
      "alt": "Crypto debit card comparison chart",
      "dimensions": "1200x630"
    }
  ],
  "word_count": 1047,
  "reading_time": "5 min"
}
```

---

## Quality Features

### Style Matching
AI analyzes the partner site's existing content and matches:
- Tone (formal, casual, technical)
- Vocabulary level
- Formatting preferences

### SEO Optimization
Every article includes:
- Keyword-optimized title
- H2/H3 structure
- Meta description
- Internal linking suggestions
- Alt text for images

### Plagiarism-Free
- 100% original content
- Plagiarism check included
- No duplicate content penalties

### Human Review
- Partner reviews before publishing
- Request edits or regenerate
- Final approval required

---

## Pricing

### Subscription (Pro/Agency)

| Plan | Articles/mo | Images/mo | Included |
|------|-------------|-----------|----------|
| Pro | 10 | 20 | ✅ |
| Agency | 50 | 100 | ✅ |

### Pay-Per-Use

| Item | Price |
|------|-------|
| Article (800-1200 words) | $2 |
| Article (1500+ words) | $4 |
| Image (single) | $0.50 |
| Image pack (5) | $2 |

---

## Use Cases

### For Link Requesters
You need a backlink but the partner site needs content:
1. Partner says "I have a slot on /resources but need an article"
2. You generate content with your link embedded
3. Partner publishes → you get backlink

### For Link Contributors  
You have link slots but no time to write:
1. Request AI content from the network
2. Review and approve
3. Publish → earn credits

### For Agencies
Scale content production:
- Generate 50 articles/month
- Each with client backlinks
- Unique images included
- No writer bottleneck

---

## Get Started

AI Content is available now for Pro and Agency plans.

**[Upgrade to Pro →](https://linkswarm.ai/dashboard)**

---

## FAQ

**What AI models do you use?**  
Claude (Sonnet) for text, DALL-E 3 for images.

**Can I edit the content?**  
Yes — full editing before approval. Or request regeneration.

**Is the content unique?**  
Yes — 100% original, plagiarism-checked. Each generation is unique.

**What languages?**  
English at launch. More languages coming.

**Who owns the content?**  
You do. Full rights to use, edit, republish.
