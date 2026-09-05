require('dotenv').config();
const http = require('http');
const { Client, RichPresence } = require('discord.js-selfbot-v13');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('[ERROR] DISCORD_TOKEN is missing in environment variables (.env)!');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Liminal Space';
const ACTIVITY_TYPE = process.env.ACTIVITY_TYPE || 'WATCHING';
const DETAILS = process.env.DETAILS || '<3';
const STATE = process.env.STATE || 'Im still alive';
const LARGE_IMAGE_URL = process.env.LARGE_IMAGE_URL || 'https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif';
const LARGE_IMAGE_TEXT = process.env.LARGE_IMAGE_TEXT || 'Liminal Space';
const APPLICATION_ID = process.env.APPLICATION_ID || '1077283441369944227';

// 1. Lightweight HTTP Server for Railway 24/7 Hosting and Uptime Monitoring
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      bot: client.user ? client.user.tag : 'connecting',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[HTTP Server] Listening on port ${PORT} for 24/7 keep-alive`);
});

// 2. Discord Selfbot Client
const client = new Client({
  checkUpdate: false,
  autoRedo: true
});

async function setCustomPresence() {
  try {
    const presence = new RichPresence(client)
      .setApplicationId(APPLICATION_ID)
      .setType(ACTIVITY_TYPE)
      .setName(APP_NAME)
      .setDetails(DETAILS)
      .setState(STATE)
      .setStartTimestamp(Date.now());

    if (LARGE_IMAGE_URL) {
      try {
        if (typeof RichPresence.getExternal === 'function') {
          const externalAssets = await RichPresence.getExternal(client, APPLICATION_ID, LARGE_IMAGE_URL);
          if (externalAssets && externalAssets.length > 0 && externalAssets[0]?.external_asset_path) {
            presence.setAssetsLargeImage(externalAssets[0].external_asset_path);
          } else {
            presence.setAssetsLargeImage(LARGE_IMAGE_URL);
          }
        } else {
          presence.setAssetsLargeImage(LARGE_IMAGE_URL);
        }
      } catch (assetErr) {
        console.warn(`[Presence Asset] Using raw image URL fallback (${assetErr.message})`);
        presence.setAssetsLargeImage(LARGE_IMAGE_URL);
      }
    }

    if (LARGE_IMAGE_TEXT) {
      presence.setAssetsLargeText(LARGE_IMAGE_TEXT);
    }

    client.user.setPresence({ activities: [presence] });
    console.log(`[Presence] Successfully updated Rich Presence for ${client.user.tag}:`);
    console.log(`   - Activity: Watching ${APP_NAME}`);
    console.log(`   - Details:  ${DETAILS}`);
    console.log(`   - State:    ${STATE}`);
    console.log(`   - Image:    ${LARGE_IMAGE_URL}`);
  } catch (err) {
    console.error('[Presence Error] Failed to set Rich Presence:', err);
  }
}

client.on('ready', async () => {
  console.log(`[Discord] Connected successfully as ${client.user.tag} (ID: ${client.user.id})`);
  await setCustomPresence();

  // Refresh presence every 30 minutes to maintain active gateway state
  setInterval(async () => {
    if (client.isReady()) {
      await setCustomPresence();
    }
  }, 30 * 60 * 1000);
});

client.on('error', (error) => {
  console.error('[Discord Error]', error.message);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`[Discord] Shard ${id} disconnected (${event.code}). Auto-reconnect handling...`);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n[System] Gracefully shutting down...');
  server.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[System] SIGTERM received. Shutting down...');
  server.close();
  client.destroy();
  process.exit(0);
});

// Login
client.login(TOKEN).catch((err) => {
  console.error('[Discord Login Error] Could not login with provided token:', err.message);
});
