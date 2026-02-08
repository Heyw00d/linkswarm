# Webhooks

Receive real-time notifications when link events occur.

---

## Overview

LinkSwarm webhooks notify your server when:
- A link opportunity is assigned to you
- A partner places a link to your site  
- Links are verified or removed
- Your credits drop below threshold

---

## Setup

### 1. Register a Webhook

```bash
curl -X POST https://api.linkswarm.ai/v1/webhooks \
  -H "Authorization: Bearer sk_linkswarm_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yoursite.com/api/linkswarm-webhook",
    "events": ["link.placed", "link.verified", "link.removed"]
  }'
```

**Response:**
```json
{
  "success": true,
  "webhook": {
    "id": 1,
    "url": "https://yoursite.com/api/linkswarm-webhook",
    "events": ["link.placed", "link.verified", "link.removed"],
    "secret": "a1b2c3d4e5f6..."
  },
  "message": "Webhook created. Save the secret - it won't be shown again."
}
```

⚠️ **Save the secret immediately** — it's only shown once.

---

## Events

| Event | Description | When Triggered |
|-------|-------------|----------------|
| `link.opportunity` | You need to place a link | Match assigned to your contribution slot |
| `link.placed` | Partner placed your link | Their crawler detected your link |
| `link.verified` | Link confirmed live | Weekly verification passed |
| `link.removed` | Link was removed | Partner removed or link broken |
| `credits.low` | Low credit warning | Credits drop below 5 |
| `new_site` | New site in your niche | Relevant site joined network |
| `match_received` | Request was matched | Your link request found a partner |
| `match_assigned` | You're assigned a match | You need to place an outbound link |

---

## Payload Format

All webhooks send JSON with this structure:

```json
{
  "event": "link.placed",
  "data": {
    "from_domain": "partner-site.com",
    "from_page": "/blog/resources",
    "to_domain": "yoursite.com",
    "to_page": "/products/main",
    "anchor_text": "best product guide",
    "relevance_score": 0.85
  },
  "timestamp": "2026-02-08T12:30:00.000Z",
  "attempt": 1
}
```

### Event-Specific Payloads

#### `link.opportunity`
```json
{
  "event": "link.opportunity",
  "data": {
    "placement_id": 123,
    "to_domain": "partner-site.com",
    "to_page": "/their-target-page",
    "anchor_text": "suggested anchor",
    "your_page": "/blog/resources",
    "deadline": "2026-02-15T00:00:00Z",
    "instructions": "Place link in resources section"
  }
}
```

#### `link.verified`
```json
{
  "event": "link.verified",
  "data": {
    "placement_id": 123,
    "from_domain": "partner-site.com",
    "to_domain": "yoursite.com",
    "verified_at": "2026-02-10T12:30:00Z",
    "credit_earned": 1
  }
}
```

#### `link.removed`
```json
{
  "event": "link.removed",
  "data": {
    "placement_id": 123,
    "from_domain": "partner-site.com",
    "reason": "link_not_found",
    "penalty": -1,
    "detected_at": "2026-02-10T12:30:00Z"
  }
}
```

#### `credits.low`
```json
{
  "event": "credits.low",
  "data": {
    "current_balance": 3,
    "threshold": 5,
    "message": "Consider contributing more link slots"
  }
}
```

---

## Security

### Signature Verification

All webhooks include a signature header:

```
X-LinkSwarm-Signature: sha256=abc123def456...
```

**Verify in Python:**
```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Remove "sha256=" prefix
    received = signature.replace("sha256=", "")
    
    return hmac.compare_digest(expected, received)

# In your webhook handler:
@app.post("/api/linkswarm-webhook")
async def handle_webhook(request):
    payload = await request.body()
    signature = request.headers.get("X-LinkSwarm-Signature", "")
    
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        raise HTTPException(401, "Invalid signature")
    
    data = json.loads(payload)
    # Process event...
```

**Verify in Node.js:**
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const received = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received)
  );
}

// Express handler
app.post('/api/linkswarm-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-linkswarm-signature'];
  
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(req.body);
  // Process event...
  
  res.status(200).send('ok');
});
```

### Additional Headers

| Header | Description |
|--------|-------------|
| `X-LinkSwarm-Event` | Event type (e.g., `link.placed`) |
| `X-LinkSwarm-Delivery` | Unique delivery ID |
| `X-LinkSwarm-Timestamp` | Unix timestamp of send |
| `X-LinkSwarm-Signature` | HMAC-SHA256 signature |

---

## Retry Logic

Failed deliveries are retried automatically:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |

After 3 failures, the delivery is logged but not retried.

**Webhook disabled after 10 consecutive failures** — re-enable via API.

---

## API Reference

### List Webhooks
```
GET /v1/webhooks
```

### Create Webhook
```
POST /v1/webhooks
{
  "url": "https://...",
  "events": ["link.placed", "link.verified"]
}
```

### Update Webhook
```
PATCH /v1/webhooks/:id
{
  "events": ["link.placed"],
  "active": true,
  "rotate_secret": true
}
```

### Delete Webhook
```
DELETE /v1/webhooks/:id
```

### Test Webhook
```
POST /v1/webhooks/test
{
  "webhook_id": 1,
  "event": "test"
}
```

### Delivery History
```
GET /v1/webhooks/:id/deliveries?limit=20
```

---

## Best Practices

1. **Always verify signatures** — never trust unverified payloads
2. **Respond quickly** — return 2xx within 10 seconds
3. **Idempotency** — use `X-LinkSwarm-Delivery` to dedupe
4. **Queue processing** — acknowledge fast, process async
5. **Monitor failures** — check delivery history regularly

---

## Limits

| Limit | Value |
|-------|-------|
| Webhooks per account | 5 |
| Payload size | 64 KB |
| Timeout | 10 seconds |
| Retry attempts | 3 |
| Failure threshold | 10 (then disabled) |
