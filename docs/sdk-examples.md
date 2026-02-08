# LinkSwarm SDK Examples

Code examples for integrating with LinkSwarm in Python and Node.js.

## Python

### Installation
```bash
pip install httpx  # No SDK package yet, use httpx
```

### Basic Client

```python
import httpx
from typing import Optional

class LinkSwarmClient:
    """LinkSwarm API client for Python."""
    
    BASE_URL = "https://api.linkswarm.ai"
    
    def __init__(self, api_key: str, timeout: float = 30.0):
        self.api_key = api_key
        self.client = httpx.Client(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
    
    def register_site(self, domain: str, name: str = None, categories: list = None):
        """Register a new site in the network."""
        return self.client.post("/v1/sites", json={
            "domain": domain,
            "name": name or domain,
            "categories": categories or [],
        }).json()
    
    def verify_site(self, domain: str):
        """Verify domain ownership after adding DNS/meta tag."""
        return self.client.post("/v1/sites/verify", json={
            "domain": domain,
        }).json()
    
    def analyze_site(self, domain: str):
        """Enable semantic matching for a site."""
        return self.client.post("/v1/sites/analyze", json={
            "domain": domain,
        }).json()
    
    def contribute(self, domain: str, page: str, max_links: int = 2, 
                   categories: list = None, context: str = None):
        """Offer a page for outbound link placement."""
        return self.client.post("/v1/pool/contribute", json={
            "domain": domain,
            "page": page,
            "max_links": max_links,
            "categories": categories,
            "context": context,
        }).json()
    
    def request_link(self, domain: str, target_page: str, 
                     preferred_anchor: str = None, categories: list = None):
        """Request a backlink to your page."""
        return self.client.post("/v1/pool/request", json={
            "domain": domain,
            "target_page": target_page,
            "preferred_anchor": preferred_anchor,
            "categories": categories,
        }).json()
    
    def get_status(self):
        """Check credits and link status."""
        return self.client.get("/v1/pool/status").json()
    
    def discover(self, categories: list = None, min_authority: int = None):
        """Find matching partner sites."""
        params = {}
        if categories:
            params["categories"] = ",".join(categories)
        if min_authority:
            params["min_authority"] = min_authority
        return self.client.get("/v1/discover", params=params).json()
    
    def list_sites(self):
        """List your registered sites."""
        return self.client.get("/v1/sites").json()


# Usage example
if __name__ == "__main__":
    client = LinkSwarmClient("sk_linkswarm_your_key_here")
    
    # Register and verify
    client.register_site("mysite.com", categories=["tech", "ai"])
    # ... add DNS TXT record ...
    client.verify_site("mysite.com")
    
    # Contribute link slots
    client.contribute(
        domain="mysite.com",
        page="/blog/resources",
        max_links=2,
        categories=["ai", "ml"]
    )
    
    # Request backlinks
    client.request_link(
        domain="mysite.com",
        target_page="/products/main",
        preferred_anchor="AI tools"
    )
    
    # Check status
    status = client.get_status()
    print(f"Credits: {status['credits_available']}")
```

---

## Node.js / TypeScript

### Installation
```bash
npm install node-fetch  # No SDK package yet, use fetch
```

### Basic Client

```typescript
// linkswarm.ts

interface LinkSwarmConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface Site {
  domain: string;
  name?: string;
  categories?: string[];
}

interface PoolStatus {
  credits_available: number;
  credits_contributed: number;
  links_received: number;
  links_pending: number;
  links_verified: number;
}

export class LinkSwarmClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: LinkSwarmConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.linkswarm.ai";
    this.timeoutMs = config.timeoutMs || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || `API error: ${res.status}`);
      }
      
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async registerSite(site: Site) {
    return this.request("POST", "/v1/sites", site);
  }

  async verifySite(domain: string) {
    return this.request("POST", "/v1/sites/verify", { domain });
  }

  async analyzeSite(domain: string) {
    return this.request("POST", "/v1/sites/analyze", { domain });
  }

  async contribute(options: {
    domain: string;
    page: string;
    max_links?: number;
    categories?: string[];
    context?: string;
  }) {
    return this.request("POST", "/v1/pool/contribute", options);
  }

  async requestLink(options: {
    domain: string;
    target_page: string;
    preferred_anchor?: string;
    categories?: string[];
  }) {
    return this.request("POST", "/v1/pool/request", options);
  }

  async getStatus(): Promise<PoolStatus> {
    return this.request("GET", "/v1/pool/status");
  }

  async discover(options?: { categories?: string[]; min_authority?: number }) {
    const params = new URLSearchParams();
    if (options?.categories) {
      params.set("categories", options.categories.join(","));
    }
    if (options?.min_authority) {
      params.set("min_authority", String(options.min_authority));
    }
    const query = params.toString() ? `?${params}` : "";
    return this.request("GET", `/v1/discover${query}`);
  }

  async listSites() {
    return this.request("GET", "/v1/sites");
  }
}

// Usage example
async function main() {
  const client = new LinkSwarmClient({
    apiKey: "sk_linkswarm_your_key_here",
  });

  // Register site
  await client.registerSite({
    domain: "mysite.com",
    name: "My Site",
    categories: ["tech", "ai"],
  });

  // Verify after adding DNS record
  await client.verifySite("mysite.com");

  // Contribute link slots
  await client.contribute({
    domain: "mysite.com",
    page: "/blog/resources",
    max_links: 2,
    categories: ["ai", "ml"],
  });

  // Request backlinks
  await client.requestLink({
    domain: "mysite.com",
    target_page: "/products/main",
    preferred_anchor: "AI tools",
  });

  // Check status
  const status = await client.getStatus();
  console.log(`Credits: ${status.credits_available}`);
}

main().catch(console.error);
```

---

## cURL Examples

### Sign Up
```bash
curl -X POST https://api.linkswarm.ai/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yoursite.com"}'
```

### Verify Email
```bash
curl -X POST https://api.linkswarm.ai/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email": "you@yoursite.com", "code": "123456"}'
```

### Register Site
```bash
curl -X POST https://api.linkswarm.ai/v1/sites \
  -H "Authorization: Bearer sk_linkswarm_your_key" \
  -H "Content-Type: application/json" \
  -d '{"domain": "mysite.com", "name": "My Site", "categories": ["tech"]}'
```

### Check Status
```bash
curl https://api.linkswarm.ai/v1/pool/status \
  -H "Authorization: Bearer sk_linkswarm_your_key"
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

Common error codes:
- `unauthorized` — Missing or invalid API key
- `invalid_email` — Bad email format
- `invalid_code` — Wrong verification code
- `domain_not_verified` — Domain ownership not confirmed
- `insufficient_credits` — Need more credits
- `rate_limited` — Too many requests (wait and retry)
- `reciprocal_blocked` — Would create A↔B pattern (90-day block)
- `semantic_mismatch` — Sites not related enough

### Retry Logic (Python)
```python
import time
import httpx

def request_with_retry(client, method, url, **kwargs):
    for attempt in range(3):
        try:
            resp = client.request(method, url, **kwargs)
            if resp.status_code == 429:  # Rate limited
                wait = int(resp.headers.get("Retry-After", 60))
                time.sleep(wait)
                continue
            return resp
        except httpx.TimeoutException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    raise Exception("Max retries exceeded")
```

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests/minute | 60 |
| Requests/hour | 500 |
| Burst | 10 concurrent |

When rate limited, response includes:
```
HTTP 429 Too Many Requests
Retry-After: 30
```

Wait the indicated seconds before retrying.
