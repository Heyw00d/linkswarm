# LinkSwarm llms.txt Generator Landing Page

## Overview
A free tool landing page for generating llms.txt files that help AI models discover and cite websites.

## Features
✅ Hero section with URL input and API integration  
✅ "What is llms.txt?" section with 4 benefit cards  
✅ "How It Works" 3-step process  
✅ "Why It Matters" section  
✅ CTA section linking to LinkSwarm signup  
✅ Dark theme with purple accents (LinkSwarm branding)  
✅ Responsive design  
✅ Copy-to-clipboard functionality  
✅ Post-generation modal with LinkSwarm CTA  

## API Integration
- Endpoint: `GET https://api.linkswarm.ai/v1/llms-txt/preview?domain={input}`
- ✅ API tested and confirmed working (HTTP 200)
- Loading states and error handling included

## Deployment
1. Upload `index.html` to LinkSwarm's web server
2. Configure DNS/routing for the tool URL
3. Test the API integration in production

## File Location
`~/clawd/linkswarm/tools/llms-txt-generator/index.html`

## Testing
- [x] File created successfully (21KB)
- [x] API endpoint verified
- [x] Code includes all required sections
- [x] Matches reference design structure
- [ ] Production deployment (pending access)

## Tech Stack
- Vanilla HTML/CSS/JavaScript
- No external dependencies
- Mobile-responsive design
- LinkSwarm brand styling (dark theme, purple accents)