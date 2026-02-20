// Load env from ~/.env.linkswarm
require('dotenv').config({ path: require('os').homedir() + '/.env.linkswarm' });

module.exports = {
  apps: [{
    name: 'linkswarm-bot',
    script: 'index.js',
    cwd: '/Users/henry/clawd/linkswarm/discord-bot',
    env: {
      DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '200M'
  }]
};
