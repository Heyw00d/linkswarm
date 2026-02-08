#!/bin/bash
# LinkSwarm Quick Start for Clawdbot
# Run: curl -sL linkswarm.ai/start.sh | bash

set -e

echo "🐝 LinkSwarm Quick Start"
echo "========================"
echo ""

# Get email
read -p "Enter your email: " EMAIL

# Join waitlist
echo "Joining waitlist..."
RESPONSE=$(curl -s -X POST https://api.linkswarm.ai/waitlist \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}")

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Error: $RESPONSE"
  exit 1
fi

echo "✅ Check your email for verification code"
echo ""
read -p "Enter verification code: " CODE

# Verify email
echo "Verifying..."
VERIFY=$(curl -s -X POST https://api.linkswarm.ai/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"code\": \"$CODE\"}")

API_KEY=$(echo "$VERIFY" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$API_KEY" ]; then
  echo "❌ Verification failed: $VERIFY"
  exit 1
fi

echo "✅ Verified! Your API key: $API_KEY"
echo ""

# Get domain
read -p "Enter your domain (e.g., mysite.com): " DOMAIN
read -p "Site name: " SITE_NAME
read -p "Categories (comma-separated, e.g., crypto,defi,fintech): " CATEGORIES

# Format categories as JSON array
CAT_JSON=$(echo "$CATEGORIES" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')

# Register site
echo "Registering site..."
REGISTER=$(curl -s -X POST https://api.linkswarm.ai/v1/sites \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"domain\": \"$DOMAIN\", \"name\": \"$SITE_NAME\", \"categories\": $CAT_JSON}")

echo "$REGISTER"
echo ""

echo "🎉 Done! Next steps:"
echo "1. Verify domain ownership (DNS TXT or meta tag)"
echo "2. Run: curl -X POST https://api.linkswarm.ai/v1/sites/verify -H 'Authorization: Bearer $API_KEY' -d '{\"domain\": \"$DOMAIN\"}'"
echo "3. Contribute link slots to start earning credits"
echo ""
echo "Docs: https://linkswarm.ai/docs/"
echo "API Key: $API_KEY"
echo ""
echo "Save your API key! Add to .env: LINKSWARM_API_KEY=$API_KEY"
