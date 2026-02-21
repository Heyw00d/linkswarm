/**
 * LinkSwarm Discord Community Bot
 * - Welcomes new members
 * - Answers questions about LinkSwarm
 * - HTTP API for message relay
 */

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const http = require('http');

// Mission Control API
const MC_API = 'https://mission-control-api.viewfi-analytics-prod.workers.dev';
const MC_KEY = 'mc-api-key-2026';
const HTTP_PORT = 3848;

async function logToMC(message) {
  try {
    await fetch(`${MC_API}/api/chat`, {
      method: 'POST',
      headers: {
        'X-API-Key': MC_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'linkswarm-bot',
        text: message,
        type: 'agent'
      })
    });
  } catch (err) {
    console.error('Failed to log to MC:', err.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// LinkSwarm knowledge base for answering questions
const LINKSWARM_INFO = {
  what: `**LinkSwarm** is an autonomous backlink exchange network where websites trade high-quality backlinks fairly and transparently.

🔗 **How it works:**
1. Register your site at linkswarm.ai/register
2. Your AI agent verifies domain ownership
3. Browse matching opportunities in the network
4. Exchange backlinks with compatible sites
5. Track your backlink portfolio

No manual outreach. No shady deals. Just fair link exchanges between verified sites.`,

  pricing: `**LinkSwarm Pricing:**
• **Free tier** — 3 link exchanges/month
• **Pro** — $29/mo, unlimited exchanges
• **Agency** — $99/mo, manage multiple domains

All plans include verification, matching algorithm, and placement tracking.`,

  register: `**To register your site:**
1. Go to https://linkswarm.ai/register
2. Enter your domain
3. Add the verification file to your site
4. Once verified, you'll appear in the network!

Takes about 2 minutes. Your site starts matching immediately.`,

  benefits: `**Why use LinkSwarm?**
✅ Automated matching — AI finds relevant sites
✅ Fair exchange — 1:1 link trades
✅ Quality control — All sites verified
✅ Track everything — See which links are live
✅ Save time — No cold outreach needed
✅ LLM visibility — Backlinks boost AI citations`,

  stats: `**Network Stats:**
• 17 verified sites
• Multiple niches (crypto, fintech, real estate, AI tools)
• Growing daily!

Join at linkswarm.ai/register`
};

// Welcome message for new members
const WELCOME_EMBED = new EmbedBuilder()
  .setColor(0x10B981)
  .setTitle('🐝 Welcome to LinkSwarm!')
  .setDescription(`Hey there! Welcome to the LinkSwarm community.

**What is LinkSwarm?**
An autonomous backlink exchange network where websites trade high-quality links fairly.

**Quick Start:**
1. Register at [linkswarm.ai/register](https://linkswarm.ai/register)
2. Verify your domain
3. Start exchanging links!

**Channels:**
• #general — Chat with the community
• #exchanges — See live link exchanges
• #signups — New member announcements
• #support — Get help

Feel free to ask questions — I'm here to help! 🐝`)
  .setFooter({ text: 'LinkSwarm • Fair link exchanges' });

// Detect questions and respond
function detectQuestion(content) {
  const lower = content.toLowerCase();
  
  if (lower.includes('what is linkswarm') || lower.includes('what does linkswarm') || lower.includes('how does linkswarm work')) {
    return LINKSWARM_INFO.what;
  }
  if (lower.includes('price') || lower.includes('pricing') || lower.includes('cost') || lower.includes('how much')) {
    return LINKSWARM_INFO.pricing;
  }
  if (lower.includes('register') || lower.includes('sign up') || lower.includes('join') || lower.includes('get started')) {
    return LINKSWARM_INFO.register;
  }
  if (lower.includes('why') || lower.includes('benefit') || lower.includes('worth it')) {
    return LINKSWARM_INFO.benefits;
  }
  if (lower.includes('stats') || lower.includes('how many') || lower.includes('network size')) {
    return LINKSWARM_INFO.stats;
  }
  
  return null;
}

// Recent messages cache (last 100)
const recentMessages = [];
const MAX_MESSAGES = 100;

// Bot ready
client.once(Events.ClientReady, (c) => {
  console.log(`🐝 LinkSwarm Bot ready! Logged in as ${c.user.tag}`);
  
  // Start HTTP server for message relay
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    
    // GET /messages - fetch recent messages
    if (url.pathname === '/messages' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const channelName = url.searchParams.get('channel');
      
      let filtered = recentMessages;
      if (channelName) {
        filtered = recentMessages.filter(m => m.channel.toLowerCase().includes(channelName.toLowerCase()));
      }
      
      res.end(JSON.stringify({
        count: filtered.length,
        messages: filtered.slice(-limit).reverse()
      }));
      return;
    }
    
    // GET /channels - list channels
    if (url.pathname === '/channels' && req.method === 'GET') {
      const channels = [];
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.forEach(ch => {
          if (ch.type === 0) { // Text channel
            channels.push({ id: ch.id, name: ch.name, guild: guild.name });
          }
        });
      });
      res.end(JSON.stringify({ channels }));
      return;
    }
    
    // POST /send - send a message
    if (url.pathname === '/send' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { channelId, message } = JSON.parse(body);
          const channel = client.channels.cache.get(channelId);
          if (!channel) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Channel not found' }));
            return;
          }
          const sent = await channel.send(message);
          res.end(JSON.stringify({ success: true, messageId: sent.id }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    
    // GET /guilds - list guilds
    if (url.pathname === '/guilds' && req.method === 'GET') {
      const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount }));
      res.end(JSON.stringify({ guilds }));
      return;
    }
    
    // POST /channels/create - create a new channel
    if (url.pathname === '/channels/create' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { guildId, name, type, private: isPrivate } = JSON.parse(body);
          const guild = client.guilds.cache.get(guildId);
          if (!guild) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Guild not found' }));
            return;
          }
          const channel = await guild.channels.create({
            name: name,
            type: type === 'voice' ? 2 : 0, // 0 = text, 2 = voice
            permissionOverwrites: isPrivate ? [
              { id: guild.roles.everyone.id, deny: ['ViewChannel'] }
            ] : []
          });
          res.end(JSON.stringify({ success: true, channelId: channel.id, name: channel.name }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    
    // Health check
    if (url.pathname === '/health') {
      res.end(JSON.stringify({ status: 'ok', guilds: client.guilds.cache.size }));
      return;
    }
    
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`📡 HTTP relay server running on http://127.0.0.1:${HTTP_PORT}`);
  });
});

// Welcome new members
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`New member joined: ${member.user.tag}`);
  
  // Log to Mission Control
  await logToMC(`🆕 New Discord member: ${member.user.tag}`);
  
  // Try to find a welcome/general channel
  const welcomeChannel = member.guild.channels.cache.find(
    ch => ch.name.includes('welcome') || ch.name.includes('general')
  );
  
  if (welcomeChannel) {
    try {
      await welcomeChannel.send({
        content: `Hey <@${member.id}>! 👋`,
        embeds: [WELCOME_EMBED]
      });
      await logToMC(`👋 Welcomed ${member.user.tag} in Discord`);
    } catch (err) {
      console.error('Failed to send welcome:', err.message);
    }
  }
});

// Handle all messages
client.on(Events.MessageCreate, async (message) => {
  // Ignore bots
  if (message.author.bot) return;
  if (!message.guild) return;
  
  const content = message.content;
  
  // Cache message for relay
  recentMessages.push({
    id: message.id,
    author: message.author.tag,
    authorId: message.author.id,
    content: content,
    channel: message.channel.name,
    channelId: message.channel.id,
    guild: message.guild.name,
    timestamp: message.createdAt.toISOString()
  });
  
  // Trim cache
  while (recentMessages.length > MAX_MESSAGES) {
    recentMessages.shift();
  }
  
  // Log all messages to MC for visibility
  await logToMC(`[#${message.channel.name}] ${message.author.tag}: ${content.substring(0, 200)}`);
  
  // Check if bot is mentioned or message contains a question
  const isMentioned = message.mentions.has(client.user);
  const isQuestion = content.includes('?');
  
  if (isMentioned || isQuestion) {
    const answer = detectQuestion(content);
    
    if (answer) {
      try {
        await message.reply(answer);
        await logToMC(`💬 Answered question from ${message.author.tag}: "${content.substring(0, 50)}..."`);
      } catch (err) {
        console.error('Failed to reply:', err.message);
      }
    }
  }
});

// Login
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set!');
  console.log('Set it with: export DISCORD_BOT_TOKEN=your_token');
  process.exit(1);
}

client.login(token);
