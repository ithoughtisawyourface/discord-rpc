require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, RichPresence, Options } = require('discord.js-selfbot-v13');

// ---------------------------------------------------------------------------
// 1. Process & Crash Protection
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTION] Uncaught Exception trapped:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH PREVENTION] Unhandled Rejection trapped:', reason);
});

// ---------------------------------------------------------------------------
// 2. Persistent Timer Management (Never resets to 0, even after restart)
// ---------------------------------------------------------------------------
const STATE_FILE = path.join(__dirname, 'rpc_state.json');

function getPersistentStartTime() {
  // If user provided a specific timestamp in environment variables, use it
  if (process.env.START_TIMESTAMP && !isNaN(Number(process.env.START_TIMESTAMP))) {
    return Number(process.env.START_TIMESTAMP);
  }

  // Otherwise check local state file
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data && data.startTime && !isNaN(Number(data.startTime))) {
        console.log(`[Timer] Resumed persistent start time from file: ${new Date(Number(data.startTime)).toISOString()}`);
        return Number(data.startTime);
      }
    }
  } catch (err) {
    console.warn('[Timer] Could not read rpc_state.json, creating a new timestamp:', err.message);
  }

  // Initialize new start time and persist
  const newStartTime = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ startTime: newStartTime }, null, 2));
    console.log(`[Timer] Initialized new persistent start time: ${new Date(newStartTime).toISOString()}`);
  } catch (err) {
    console.warn('[Timer] Could not write rpc_state.json:', err.message);
  }
  return newStartTime;
}

const START_TIMESTAMP = getPersistentStartTime();

// ---------------------------------------------------------------------------
// 3. Multi-Token Discovery (Case-Insensitive for Railway Variables)
// ---------------------------------------------------------------------------
function getDiscordTokens() {
  const tokenSet = new Set();

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || typeof value !== 'string') continue;
    const cleanVal = value.trim();
    if (!cleanVal) continue;

    // Match Discord_Token1, Discord_TOken2, Discord_Token3, DISCORD_TOKEN, etc.
    if (/^discord.*token/i.test(key)) {
      tokenSet.add(cleanVal);
    }
  }

  return Array.from(tokenSet);
}

const TOKENS = getDiscordTokens();

if (TOKENS.length === 0) {
  console.error('[ERROR] No Discord tokens found in environment variables!');
  console.error('Please set Discord_Token1, Discord_TOken2, Discord_Token3, or DISCORD_TOKEN.');
  process.exit(1);
}

console.log(`[Startup] Detected ${TOKENS.length} Discord token(s) configured.`);

// ---------------------------------------------------------------------------
// 4. Configuration Variables
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Liminal Space';
const ACTIVITY_TYPE = process.env.ACTIVITY_TYPE || 'WATCHING';
const DETAILS = process.env.DETAILS || '<3';
const STATE = process.env.STATE || 'Im still alive';
const LARGE_IMAGE_URL = process.env.LARGE_IMAGE_URL || 'https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif';
const LARGE_IMAGE_TEXT = process.env.LARGE_IMAGE_TEXT || 'Liminal Space';
const APPLICATION_ID = process.env.APPLICATION_ID || '1077283441369944227';

// ---------------------------------------------------------------------------
// 5. Active Memory Cleaner (Triggered at 0.4 GB / 400 MB)
// ---------------------------------------------------------------------------
const MEMORY_THRESHOLD_MB = 400; // 0.4 GB
const MEMORY_THRESHOLD_BYTES = MEMORY_THRESHOLD_MB * 1024 * 1024;

function runMemoryCleaner(clients) {
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);

  if (mem.rss >= MEMORY_THRESHOLD_BYTES) {
    console.warn(`[Memory Alert] RSS memory reached ${rssMB} MB (Threshold: ${MEMORY_THRESHOLD_MB} MB). Cleaning memory...`);

    // 1. Clear caches from all active clients
    for (const client of clients) {
      try {
        if (client && client.isReady()) {
          client.users?.cache?.clear();
          client.channels?.cache?.clear();
          client.guilds?.cache?.clear();
        }
      } catch (err) {
        // Safe fail
      }
    }

    // 2. Invoke V8 Garbage Collector if available (--expose-gc)
    if (typeof global.gc === 'function') {
      try {
        global.gc();
        const afterMem = process.memoryUsage();
        const afterRssMB = (afterMem.rss / 1024 / 1024).toFixed(2);
        console.log(`[Memory Cleaner] GC completed successfully! RSS lowered from ${rssMB} MB to ${afterRssMB} MB.`);
      } catch (gcErr) {
        console.error('[Memory Cleaner] GC error:', gcErr.message);
      }
    } else {
      console.warn('[Memory Cleaner] Notice: Node.js was not started with --expose-gc, garbage collection will run automatically.');
    }
  }
}

// ---------------------------------------------------------------------------
// 6. HTTP Keep-Alive & Health Monitoring Server
// ---------------------------------------------------------------------------
const clients = [];
const clientStatusMap = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    const mem = process.memoryUsage();
    const stats = {
      status: 'online',
      active_tokens: TOKENS.length,
      connected_accounts: Array.from(clientStatusMap.values()),
      memory: {
        rss_mb: +(mem.rss / 1024 / 1024).toFixed(2),
        heap_used_mb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        threshold_mb: MEMORY_THRESHOLD_MB
      },
      timer: {
        started_at: new Date(START_TIMESTAMP).toISOString(),
        elapsed_seconds: Math.floor((Date.now() - START_TIMESTAMP) / 1000)
      },
      process_uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[HTTP Server] Listening on port ${PORT} for 24/7 Railway keep-alive ping`);
});

// Periodic memory check every 30 seconds
setInterval(() => {
  runMemoryCleaner(clients);
}, 30 * 1000);

// ---------------------------------------------------------------------------
// 7. Discord Client Factory & Presence Engine
// ---------------------------------------------------------------------------
async function buildPresence(client) {
  const presence = new RichPresence(client)
    .setApplicationId(APPLICATION_ID)
    .setType(ACTIVITY_TYPE)
    .setName(APP_NAME)
    .setDetails(DETAILS)
    .setState(STATE)
    .setStartTimestamp(START_TIMESTAMP);

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
    } catch {
      presence.setAssetsLargeImage(LARGE_IMAGE_URL);
    }
  }

  if (LARGE_IMAGE_TEXT) {
    presence.setAssetsLargeText(LARGE_IMAGE_TEXT);
  }

  return presence;
}

function startDiscordClient(token, index) {
  // Ultra-lean client setup: strip memory-heavy caches to guarantee < 0.4 GB
  const client = new Client({
    checkUpdate: false,
    autoRedo: true,
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,
      GuildMemberManager: 0,
      UserManager: 0,
      ReactionManager: 0,
      StageInstanceManager: 0,
      ThreadManager: 0,
      PresenceManager: 0
    })
  });

  clients.push(client);

  client.on('ready', async () => {
    console.log(`[Discord Client #${index + 1}] Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    clientStatusMap.set(index, {
      index: index + 1,
      tag: client.user.tag,
      id: client.user.id,
      status: 'active'
    });

    try {
      const presence = await buildPresence(client);
      client.user.setPresence({ activities: [presence] });
      console.log(`[Discord Client #${index + 1}] Rich Presence activated: Watching ${APP_NAME}`);
    } catch (err) {
      console.error(`[Discord Client #${index + 1}] Failed to set presence:`, err.message);
    }

    // Refresh presence every 30 minutes without changing start time
    setInterval(async () => {
      if (client.isReady()) {
        try {
          const presence = await buildPresence(client);
          client.user.setPresence({ activities: [presence] });
        } catch (err) {
          console.error(`[Discord Client #${index + 1}] Periodic presence refresh error:`, err.message);
        }
      }
    }, 30 * 60 * 1000);
  });

  client.on('error', (err) => {
    console.error(`[Discord Client #${index + 1} Error]:`, err.message);
  });

  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[Discord Client #${index + 1}] Shard ${shardId} disconnected (${event.code}). Auto-reconnecting...`);
  });

  client.login(token).catch((err) => {
    console.error(`[Discord Client #${index + 1} Login Failed]:`, err.message);
    clientStatusMap.set(index, {
      index: index + 1,
      status: 'login_error',
      error: err.message
    });
  });
}

// Start all configured tokens
TOKENS.forEach((token, idx) => {
  startDiscordClient(token, idx);
});

// ---------------------------------------------------------------------------
// 8. Graceful Shutdown
// ---------------------------------------------------------------------------
function shutdown(signal) {
  console.log(`\n[System] ${signal} received. Cleaning up...`);
  server.close();
  for (const client of clients) {
    try {
      client.destroy();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
