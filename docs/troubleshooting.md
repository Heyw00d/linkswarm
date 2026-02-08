# Troubleshooting

Common issues and how to fix them.

---

## Domain Verification Failed

**Error:** `domain_not_verified`

**Causes:**
- DNS record not propagated yet
- Incorrect token format
- Wrong record type

**Solutions:**

1. **Check DNS propagation:**
   ```bash
   dig TXT _linkswarm.yourdomain.com
   ```

2. **Wait 10-15 minutes** — DNS can take time to propagate globally

3. **Verify exact token match:**
   - No extra spaces
   - Correct record: `_linkswarm.yourdomain.com`
   - Value: `ls-verify=YOUR_TOKEN`

4. **Try alternative methods:**
   - Meta tag: `<meta name="linkswarm-verify" content="YOUR_TOKEN">`
   - File: `/.well-known/linkswarm-verify.txt` containing the token

5. **Check for typos** in the domain you registered vs your actual domain

---

## Insufficient Credits

**Error:** `insufficient_credits`

**Cause:** Tried to request links without enough credits in your account.

**Solutions:**

1. **Check your balance:**
   ```bash
   curl https://api.linkswarm.ai/v1/pool/status \
     -H "Authorization: Bearer sk_linkswarm_..."
   ```

2. **Contribute link slots first:**
   ```json
   POST /v1/pool/contribute
   {
     "domain": "yoursite.com",
     "page": "/blog/resources",
     "max_links": 2
   }
   ```

3. **Wait for verification** — after placing a link, crawler verifies within 24-48 hours

4. **Each verified link = 1 credit earned**

**Tip:** Contribute 5-10 slots before requesting to build a buffer.

---

## No Partner Matches Found

**Error:** Empty results from `/v1/discover`

**Causes:**
- Network doesn't have sites in your niche yet
- Categories too narrow
- Semantic matching not enabled

**Solutions:**

1. **Enable semantic matching:**
   ```json
   POST /v1/sites/analyze
   {"domain": "yoursite.com"}
   ```

2. **Broaden your categories:**
   - Instead of just `["defi"]`, try `["crypto", "fintech", "blockchain"]`

3. **Check network size:**
   - Browse `/registry` to see current sites
   - Early network = fewer matches (this improves as network grows)

4. **Manual outreach:**
   - Contact specific sites in registry directly
   - Propose mutual network participation

---

## Rate Limited (429)

**Error:** `rate_limited` with HTTP 429

**Cause:** Too many requests in a short period.

**Solutions:**

1. **Check headers:**
   ```
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1707364800
   ```

2. **Wait for reset:** Convert Unix timestamp to see when limit resets

3. **Implement backoff:**
   ```python
   import time
   
   def request_with_retry(func, max_retries=3):
       for attempt in range(max_retries):
           try:
               return func()
           except RateLimitError as e:
               wait = e.retry_after or (2 ** attempt * 10)
               time.sleep(wait)
       raise Exception("Max retries exceeded")
   ```

4. **Upgrade tier** if you need higher limits:
   - Free: 60/min
   - Pro: 300/min
   - Agency: 600/min

---

## Link Not Verified

**Symptom:** Contributed a link slot, placed the link, but no credit earned.

**Causes:**
- Link not actually on page
- Link in wrong location (footer/sidebar)
- Page not accessible to crawler
- `nofollow` attribute on link

**Solutions:**

1. **Verify link is live:**
   ```bash
   curl -s yoursite.com/page | grep "partnersite.com"
   ```

2. **Check placement:**
   - Link must be in content body
   - Not in footer, sidebar, or navigation
   - Should be contextually relevant

3. **Check robots.txt:**
   - Ensure page isn't blocked from crawling

4. **Remove nofollow:**
   - Links must be dofollow to count
   - `rel="nofollow"` disqualifies the link

5. **Wait 24-48 hours** — verification crawler runs periodically

---

## API Key Issues

### Invalid API Key

**Error:** `unauthorized`

**Solutions:**
- Check for typos in key
- Ensure `Bearer ` prefix (with space)
- Key may have been rotated — check email for new key

### Lost API Key

**Solution:** Request key reset via dashboard or email support.

### Key Rotation

```bash
curl -X POST https://api.linkswarm.ai/rotate-key \
  -H "Authorization: Bearer sk_linkswarm_current_key"
```

Old key invalidated immediately. Store new key securely.

---

## Semantic Matching Not Working

**Symptom:** Analysis completed but matches seem random.

**Causes:**
- Site has thin content
- Categories don't match actual content
- Embedding quality low

**Solutions:**

1. **Re-run analysis** after adding more content:
   ```json
   POST /v1/sites/analyze
   {"domain": "yoursite.com"}
   ```

2. **Update categories** to match your actual content

3. **Add more content:**
   - Pages with 500+ words index better
   - More pages = richer embedding

---

## Still Stuck?

1. **Check API status:** https://api.linkswarm.ai/health
2. **Review docs:** https://linkswarm.ai/docs/
3. **Twitter:** [@Link_Swarm](https://x.com/Link_Swarm)
4. **Email:** support@linkswarm.ai

---

## Common Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `unauthorized` | 401 | Invalid or missing API key |
| `invalid_email` | 400 | Bad email format |
| `invalid_code` | 400 | Wrong verification code |
| `domain_not_verified` | 403 | Verify domain first |
| `insufficient_credits` | 402 | Need more credits |
| `rate_limited` | 429 | Too many requests |
| `reciprocal_blocked` | 403 | Would create A↔B pattern |
| `semantic_mismatch` | 400 | Sites not related enough |
| `domain_exists` | 409 | Domain already registered |
| `invalid_domain` | 400 | Bad domain format |
