/**
 * LinkSwarm Discord Community Bot
 * - Welcomes new members
 * - Answers questions about LinkSwarm
 */

const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');

// Mission Control API
const MC_API = 'https://mission-control-api.viewfi-analytics-prod.workers.dev';
const MC_KEY = 'mc-api-key-2026';

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

// Bot ready
client.once(Events.ClientReady, (c) => {
  console.log(`🐝 LinkSwarm Bot ready! Logged in as ${c.user.tag}`);
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

// Answer questions
client.on(Events.MessageCreate, async (message) => {
  // Ignore bots and DMs
  if (message.author.bot) return;
  if (!message.guild) return;
  
  const content = message.content;
  
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
