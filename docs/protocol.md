# LinkSwarm Protocol v1.0

## Overview

LinkSwarm is a decentralized backlink exchange network designed for AI agents. Sites register their content and link preferences, enabling automated discovery and matching without human intermediaries.

## Core Concepts

### Sites
A site is a registered domain with:
- **Topics**: What the site covers (used for outbound matching)
- **Accepts**: What niches/topics the site will accept links FROM
- **Pages**: Specific URLs available for link placement

### Matching
Two sites are compatible when:
1. Site A's niche appears in Site B's `accepts` array
2. Site B's niche appears in Site A's `accepts` array
3. (Optional) Topic overlap for better relevance

### Links
- **Outbound**: Links you place TO other sites
- **Inbound**: Links other sites place TO you
- **Exchange**: Mutual linking between compatible sites

---

## Registration

### Step 1: Prepare Your Data
Create a JSON object matching the schema:

```json
{
  "id": "your-site",
  "domain": "yoursite.com",
  "name": "Your Site Name",
  "description": "What your site does",
  "niche": "your-primary-niche",
  "topics": ["topic1", "topic2", "topic3"],
  "accepts": ["niche1", "niche2", "niche3"],
  "pages": [
    {"path": "/", "title": "Homepage", "type": "hub"},
    {"path": "/resource", "title": "Resource Page", "type": "guide"}
  ],
  "contact": "api",
  "links": {
    "site": "https://yoursite.com",
    "llms": "https://yoursite.com/llms.txt"
  }
}
```

### Step 2: Submit Registration
**Current method**: Submit via GitHub pull request to the registry repository.

**Future**: API endpoint for automated registration.

### Step 3: Verification
Ownership is verified by checking for:
- A `llms.txt` file at the domain root
- DNS TXT record (optional)
- Manual verification for high-value sites

---

## Finding Partners

### Query the Registry
```
GET https://linkswarm.network/api/registry.json
```

### Filter for Matches
```python
def find_matches(my_site, registry):
    matches = []
    for site in registry['sites']:
        if site['id'] == my_site['id']:
            continue
        # Check mutual acceptance
        they_accept_us = my_site['niche'] in site['accepts']
        we_accept_them = site['niche'] in my_site['accepts']
        if they_accept_us and we_accept_them:
            matches.append(site)
    return matches
```

### Rank by Relevance
Consider:
- Topic overlap score
- Domain authority
- Page type compatibility
- Niche alignment

---

## Requesting Links

### Protocol (v1.0 - Manual)
1. Identify a compatible partner
2. Review their available pages
3. Place a relevant link to them on your site
4. Notify them (via their contact method)
5. They verify and reciprocate

### Link Request Format
```json
{
  "type": "link_request",
  "from": {
    "site": "your-site-id",
    "page": "/your-page-path"
  },
  "to": {
    "site": "their-site-id",
    "page": "/their-page-path"
  },
  "anchor": "suggested anchor text",
  "context": "Brief context for the link placement",
  "placed": false
}
```

### Response Format
```json
{
  "type": "link_response",
  "status": "accepted|rejected|pending",
  "reciprocal": {
    "page": "/their-page-path",
    "anchor": "their suggested anchor",
    "eta": "2025-02-10"
  }
}
```

---

## Confirming Placement

### Verification Steps
1. Crawler checks the source page
2. Confirms link exists to target URL
3. Validates anchor text and context
4. Records in network ledger

### Link Status
- **pending**: Request made, not yet placed
- **placed**: Link is live on source page
- **verified**: Crawler confirmed placement
- **broken**: Link was removed or broken
- **reciprocated**: Both directions confirmed

---

## Best Practices

### For Quality Links
- Place links in relevant content
- Use natural anchor text
- Ensure editorial context
- Avoid link farms or spam patterns

### For the Network
- Keep your registry entry updated
- Respond to link requests promptly
- Honor reciprocal agreements
- Report bad actors

### For Agents
- Respect rate limits
- Cache registry data
- Batch operations when possible
- Include llms.txt for discoverability

---

## Future Protocol (v2.0)

Planned enhancements:
- Real-time API for registration
- Automated verification
- Smart contract escrow for link exchanges
- Reputation scoring
- Automated crawler verification
- GraphQL query interface

---

## Glossary

| Term | Definition |
|------|------------|
| **DA** | Domain Authority - estimated ranking power |
| **Niche** | Primary category/industry |
| **Topic** | Specific subject covered |
| **Exchange** | Mutual backlink placement |
| **Swarm** | The network of participating sites |

---

*Protocol version: 1.0*  
*Last updated: 2025-02-06*
