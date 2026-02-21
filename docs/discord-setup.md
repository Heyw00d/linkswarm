# LinkSwarm Discord Setup

## Channel Structure

### 1. 🔒 #signups (Private - Admin Only)
Webhook posts here when new users sign up.
- Shows email and source
- Admin visibility only

### 2. 👋 #welcome (Read Only)
**Pinned Message:**
```
🐝 **Welcome to LinkSwarm!**

The backlink exchange network for indie makers, startups, and SaaS founders.

**How it works:**
→ You add links to other sites
→ Other sites add links to yours
→ Everyone's SEO improves 📈

**Get started:** Head to #start-here

**Links:**
🌐 Dashboard: https://linkswarm.ai/dashboard
🐦 Twitter: https://x.com/Link_Swarm
📚 Docs: https://linkswarm.ai/docs
```

### 3. 📖 #start-here (Read Only)
**Pinned Message:**
```
# 🚀 How LinkSwarm Works

## Step 1: Add Your Site
Go to https://linkswarm.ai/dashboard and add your domain.

## Step 2: Verify Ownership
Add the TXT record we provide to your DNS. This proves you own the site.

## Step 3: Contribute Pages
Tell us which pages on your site can include outbound links (blog posts, resource pages, etc.)

Each page you contribute = **1 credit earned** 💰

## Step 4: Request Backlinks
Spend your credits to request backlinks to your site. We'll match you with relevant sites in the network.

## Step 5: Place Links
When you're matched, add the link to your contributed page. Once verified, everyone wins!

---

**The Exchange:**
- You add a link to Site A → You earn credit
- Site B adds a link to you → They earn credit
- It's NOT reciprocal (A→B→C) so link profiles stay natural 🎯

**Questions?** Ask in #support
**Ready?** → https://linkswarm.ai/dashboard
```

### 4. 💬 #community
Open discussion channel.
- Share your site launches
- Post your tweets (we RT good ones!)
- Network with other founders
- Celebrate backlink wins 🎉

### 5. 🛠 #support
Technical help and feature requests.
- Verification issues
- API questions  
- Feature requests
- Bug reports

### 6. 🔗 #exchanges (Automated)
Bot posts here automatically:
- 🌐 New Site Joined: `domain.com` joined the network!
- 🔗 New Match: `site-a.com` → `site-b.com`
- ✅ Link Verified: Backlink from `site-a.com` confirmed!

---

## Webhook Setup

**#signups webhook:** `DISCORD_SIGNUPS_WEBHOOK`
**#exchanges webhook:** `DISCORD_WEBHOOK_URL`

Both configured in Cloudflare Worker secrets.
