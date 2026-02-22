#!/usr/bin/env node
/**
 * LinkSwarm Article Generator
 * 
 * Generates blog articles with backlinks and hero images for the network.
 * 
 * Usage:
 *   node generate-article.js --topic "AI Tools for Productivity" --backlinks '["sonicker.com","whisperweb.dev"]'
 *   node generate-article.js --placement-id 123  # Generate from assigned placement
 */

const fs = require('fs');
const path = require('path');

const RECRAFT_API_KEY = 'KcCXJnBBts86DbgnOi6NlV339xrfKkTK4dhc6vlov9nQO0vXWCXkpS4LZ6pMAFHS';
const RECRAFT_URL = 'https://external.api.recraft.ai/v1/images/generations';

// Article template
const ARTICLE_TEMPLATE = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}} | LinkSwarm Blog</title>
    <meta name="description" content="{{DESCRIPTION}}">
    <meta property="og:title" content="{{TITLE}}">
    <meta property="og:description" content="{{DESCRIPTION}}">
    <meta property="og:image" content="{{OG_IMAGE}}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@Link_Swarm">
    <link rel="canonical" href="https://linkswarm.ai/blog/{{SLUG}}/">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config={theme:{extend:{colors:{honey:{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f'},swarm:{900:'#0a0a0f',800:'#12121a',700:'#1a1a25',600:'#252533'}}}}}</script>
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');body{font-family:'Inter',sans-serif}.swarm-bg{background:radial-gradient(ellipse at 50% 0%,rgba(251,191,36,0.15) 0%,transparent 50%),radial-gradient(ellipse at 80% 50%,rgba(139,92,246,0.1) 0%,transparent 40%)}.prose h2{color:#fbbf24;margin-top:2.5rem;margin-bottom:1rem;font-size:1.5rem;font-weight:700}.prose h3{color:#fde68a;margin-top:2rem;margin-bottom:0.75rem;font-size:1.25rem;font-weight:600}.prose p{margin-bottom:1.25rem;line-height:1.8}.prose ul,.prose ol{margin-bottom:1.25rem;padding-left:1.5rem}.prose li{margin-bottom:0.5rem;line-height:1.7}.prose a{color:#fbbf24;text-decoration:underline}.prose a:hover{color:#fde68a}.prose blockquote{border-left:4px solid #fbbf24;padding-left:1rem;margin:1.5rem 0;font-style:italic;color:#d1d5db}</style>
</head>
<body class="bg-swarm-900 text-gray-100 swarm-bg min-h-screen">
<nav class="fixed top-0 left-0 right-0 z-50 bg-swarm-900/90 backdrop-blur-md border-b border-honey-400/10"><div class="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center"><a href="/" class="flex items-center gap-2 text-xl font-bold"><span class="text-2xl">🐝</span><span class="text-honey-400">Link</span><span class="text-white">Swarm</span></a><div class="flex items-center gap-6"><a href="/blog/" class="text-gray-300 hover:text-honey-400">Blog</a><a href="/docs/" class="text-gray-300 hover:text-honey-400">Docs</a><a href="/register/" class="bg-honey-500 hover:bg-honey-400 text-swarm-900 font-semibold px-4 py-2 rounded-lg">Join Network</a></div></div></nav>
<article class="pt-32 pb-20 px-6"><div class="max-w-3xl mx-auto">
<header class="mb-12">
    <div class="flex items-center gap-3 text-sm text-gray-400 mb-4">
        <span>{{DATE}}</span><span>•</span><span>{{READ_TIME}} min read</span><span>•</span><span class="text-honey-400">{{CATEGORY}}</span>
    </div>
    <h1 class="text-4xl md:text-5xl font-bold mb-6 leading-tight">{{TITLE_HTML}}</h1>
    <p class="text-xl text-gray-300 leading-relaxed">{{SUBTITLE}}</p>
    {{HERO_IMAGE}}
</header>
<div class="prose prose-lg max-w-none text-gray-300">
{{CONTENT}}
</div>
<div class="mt-16 p-8 rounded-2xl bg-gradient-to-r from-honey-500/10 to-purple-500/10 border border-honey-400/20 text-center">
    <h3 class="text-2xl font-bold mb-4">Build your backlink network</h3>
    <p class="text-gray-300 mb-6">Join LinkSwarm and start exchanging quality backlinks with relevant sites.</p>
    <a href="/register/" class="inline-block bg-honey-500 hover:bg-honey-400 text-swarm-900 font-bold px-8 py-4 rounded-xl text-lg">Join the Swarm →</a>
</div>
</div></article>
<footer class="border-t border-honey-400/10 py-12 px-6"><div class="max-w-4xl mx-auto text-center text-gray-500"><p>© 2026 LinkSwarm. Building the future of link exchange.</p></div></footer>
</body>
</html>`;

async function generateImage(prompt, outputPath) {
    console.log('🎨 Generating hero image with Recraft...');
    
    const response = await fetch(RECRAFT_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RECRAFT_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: prompt,
            style: 'digital_illustration',
            size: '1024x1024'
        })
    });
    
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Recraft API error: ${err}`);
    }
    
    const data = await response.json();
    const imageUrl = data.data[0].url;
    
    // Download the image
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    console.log(`✅ Image saved to ${outputPath}`);
    return imageUrl;
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
}

function generateArticleHTML(config) {
    const {
        title,
        titleHtml,
        subtitle,
        description,
        category,
        content,
        slug,
        heroImagePath,
        date,
        readTime
    } = config;
    
    let html = ARTICLE_TEMPLATE;
    
    html = html.replace(/{{TITLE}}/g, title);
    html = html.replace(/{{TITLE_HTML}}/g, titleHtml || title);
    html = html.replace(/{{SUBTITLE}}/g, subtitle);
    html = html.replace(/{{DESCRIPTION}}/g, description);
    html = html.replace(/{{SLUG}}/g, slug);
    html = html.replace(/{{DATE}}/g, date);
    html = html.replace(/{{READ_TIME}}/g, readTime || '5');
    html = html.replace(/{{CATEGORY}}/g, category);
    html = html.replace(/{{OG_IMAGE}}/g, `https://linkswarm.ai/blog/${slug}/hero.png`);
    html = html.replace(/{{CONTENT}}/g, content);
    
    if (heroImagePath) {
        html = html.replace(/{{HERO_IMAGE}}/g, 
            `<img src="hero.png" alt="${title}" class="mt-8 rounded-xl w-full">`);
    } else {
        html = html.replace(/{{HERO_IMAGE}}/g, '');
    }
    
    return html;
}

// Article topics with backlink opportunities
const ARTICLE_IDEAS = [
    {
        topic: 'Best AI Voice Tools in 2026',
        backlinks: ['sonicker.com', 'whisperweb.dev'],
        category: 'AI Tools',
        imagePrompt: 'Modern AI voice synthesis visualization, sound waves transforming into speech, dark tech aesthetic with purple and cyan accents, digital illustration'
    },
    {
        topic: 'Crypto Payment Solutions for E-commerce',
        backlinks: ['coinpayportal.com', 'usdckey.com'],
        category: 'Crypto & Fintech',
        imagePrompt: 'Cryptocurrency payment gateway visualization, digital coins flowing through secure portal, futuristic fintech aesthetic, dark background with gold accents'
    },
    {
        topic: 'Freelance Platforms for Web3 Talent',
        backlinks: ['ugig.net'],
        category: 'Freelance & Gig Economy',
        imagePrompt: 'Freelance marketplace connecting global talent, decentralized work network visualization, modern digital illustration with blockchain elements'
    },
    {
        topic: 'Browser Productivity Tools You Need',
        backlinks: ['marksyncr.com', 'pairux.com'],
        category: 'Productivity',
        imagePrompt: 'Browser productivity tools visualization, floating browser windows with sync icons, clean modern tech illustration, blue and purple gradient'
    },
    {
        topic: 'AI Analytics for Digital Advertising',
        backlinks: ['adrail.ai'],
        category: 'Marketing & Analytics',
        imagePrompt: 'AI analytics dashboard for advertising, data visualization with charts and AI insights, modern tech aesthetic, dark theme with accent colors'
    },
    {
        topic: 'Speech-to-Text Tools for Content Creators',
        backlinks: ['whisperweb.dev', 'sonicker.com'],
        category: 'AI Tools',
        imagePrompt: 'Speech transcription visualization, voice waves converting to text, modern AI interface, dark purple background with glowing elements'
    },
    {
        topic: 'Best Crypto Card Comparison Guide',
        backlinks: ['spendbase.cards', 'viewfi.io'],
        category: 'Crypto & Fintech',
        imagePrompt: 'Crypto debit cards floating in futuristic display, comparison chart visualization, sleek fintech aesthetic with gold and dark blue'
    },
    {
        topic: 'USDC and Stablecoin Payment Gateways',
        backlinks: ['usdckey.com', 'coinpayportal.com'],
        category: 'Crypto & Fintech',
        imagePrompt: 'Stablecoin payment flow visualization, USDC coins flowing through digital gateway, clean fintech illustration with blue tones'
    },
    {
        topic: 'Remote Collaboration Tools for Teams',
        backlinks: ['pairux.com', 'marksyncr.com'],
        category: 'Productivity',
        imagePrompt: 'Remote team collaboration visualization, connected screens and shared workspaces, modern tech illustration with purple and teal'
    },
    {
        topic: 'Web3 Gig Economy: Where to Find Crypto Jobs',
        backlinks: ['ugig.net', 'viewfi.io'],
        category: 'Freelance & Gig Economy',
        imagePrompt: 'Web3 job marketplace visualization, blockchain-connected freelancers, decentralized work network, modern digital illustration'
    }
];

async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--list')) {
        console.log('📝 Available article ideas:\n');
        ARTICLE_IDEAS.forEach((idea, i) => {
            console.log(`${i + 1}. ${idea.topic}`);
            console.log(`   Backlinks: ${idea.backlinks.join(', ')}`);
            console.log(`   Category: ${idea.category}\n`);
        });
        return;
    }
    
    const indexArg = args.findIndex(a => a === '--idea');
    if (indexArg === -1) {
        console.log('Usage:');
        console.log('  node generate-article.js --list           # List article ideas');
        console.log('  node generate-article.js --idea 1         # Generate article #1');
        console.log('  node generate-article.js --idea 1 --dry   # Preview without generating');
        return;
    }
    
    const ideaNum = parseInt(args[indexArg + 1]) - 1;
    if (isNaN(ideaNum) || ideaNum < 0 || ideaNum >= ARTICLE_IDEAS.length) {
        console.log('Invalid idea number. Use --list to see available ideas.');
        return;
    }
    
    const idea = ARTICLE_IDEAS[ideaNum];
    const isDry = args.includes('--dry');
    
    console.log(`\n🐝 Generating article: "${idea.topic}"`);
    console.log(`   Backlinks: ${idea.backlinks.join(', ')}`);
    console.log(`   Category: ${idea.category}`);
    
    const slug = slugify(idea.topic);
    const outputDir = path.join(__dirname, '..', 'blog', slug);
    
    if (!isDry) {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }
    
    console.log(`   Output: /blog/${slug}/`);
    
    if (isDry) {
        console.log('\n[DRY RUN] Would generate:');
        console.log(`  - Hero image with prompt: "${idea.imagePrompt}"`);
        console.log(`  - Article HTML with backlinks to: ${idea.backlinks.join(', ')}`);
        return;
    }
    
    // Generate hero image
    const heroPath = path.join(outputDir, 'hero.png');
    await generateImage(idea.imagePrompt, heroPath);
    
    // For now, create placeholder content (in production, would use LLM)
    const backlinksHtml = idea.backlinks.map(domain => 
        `<a href="https://${domain}" target="_blank">${domain}</a>`
    ).join(', ');
    
    const content = `
<p>The landscape of ${idea.category.toLowerCase()} is evolving rapidly. In this guide, we explore the tools and platforms that are reshaping how we work.</p>

<h2>Why This Matters</h2>
<p>As technology advances, having the right tools becomes crucial for staying competitive. The platforms we'll cover today represent the cutting edge of innovation in their respective fields.</p>

<h2>Top Picks</h2>
<p>After extensive research and testing, we've identified several standout platforms worth your attention:</p>

<ul>
${idea.backlinks.map(domain => `<li><strong><a href="https://${domain}" target="_blank">${domain}</a></strong> - A leading solution in the ${idea.category.toLowerCase()} space.</li>`).join('\n')}
</ul>

<h2>Making Your Choice</h2>
<p>When selecting tools for your workflow, consider factors like integration capabilities, pricing, and long-term support. The platforms mentioned above (${backlinksHtml}) all excel in these areas.</p>

<h2>Conclusion</h2>
<p>The tools you choose can make or break your productivity. We recommend exploring each of the platforms mentioned to find the best fit for your needs.</p>
`;

    const date = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const articleHtml = generateArticleHTML({
        title: idea.topic,
        titleHtml: idea.topic,
        subtitle: `A comprehensive guide to the best ${idea.category.toLowerCase()} solutions`,
        description: `Discover the top ${idea.category.toLowerCase()} tools including ${idea.backlinks.join(', ')}`,
        category: idea.category,
        content: content,
        slug: slug,
        heroImagePath: 'hero.png',
        date: date,
        readTime: '4'
    });
    
    fs.writeFileSync(path.join(outputDir, 'index.html'), articleHtml);
    
    console.log(`\n✅ Article generated!`);
    console.log(`   Path: /blog/${slug}/`);
    console.log(`   Preview: https://linkswarm.ai/blog/${slug}/`);
    console.log(`\nNext steps:`);
    console.log(`   1. Review and enhance the content`);
    console.log(`   2. git add && git commit`);
    console.log(`   3. Deploy to Cloudflare Pages`);
}

main().catch(console.error);
