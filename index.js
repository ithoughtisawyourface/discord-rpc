require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, RichPresence, Options } = require('discord.js-selfbot-v13');

// ---------------------------------------------------------------------------
// 1. Bulletproof Process Crash Protection
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTION] Trapped Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH PREVENTION] Trapped Unhandled Rejection:', reason);
});

// ---------------------------------------------------------------------------
// 2. Configuration Settings
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Arcturus';
const ACTIVITY_TYPE = process.env.ACTIVITY_TYPE || 'PLAYING';
const DETAILS = process.env.DETAILS || 'Playing Factions';
const STATE = process.env.STATE || 'play.arcturusmc.org';
const LARGE_IMAGE_URL = process.env.LARGE_IMAGE_URL || 'https://files.catbox.moe/tzppxh.png';
const LARGE_IMAGE_TEXT = process.env.LARGE_IMAGE_TEXT || 'Arcturus';
const BUTTON1_NAME = process.env.BUTTON1_NAME || 'Discord 💎';
const BUTTON1_URL = process.env.BUTTON1_URL || 'https://discord.com/invite/DTR6serkeM';
const BUTTON2_NAME = process.env.BUTTON2_NAME || 'Web 💫';
const BUTTON2_URL = process.env.BUTTON2_URL || 'https://www.arcturusmc.org/';
const APPLICATION_ID = process.env.APPLICATION_ID || '1077283441369944227';
const MEMORY_THRESHOLD_MB = 400; // 0.4 GB Railway threshold
const MEMORY_THRESHOLD_BYTES = MEMORY_THRESHOLD_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// 3. Persistent Elapsed Timer (Never resets across crashes or restarts)
// ---------------------------------------------------------------------------
const STATE_FILE = path.join(__dirname, 'rpc_state.json');

function getPersistentStartTime() {
  if (process.env.START_TIMESTAMP && !isNaN(Number(process.env.START_TIMESTAMP))) {
    return Number(process.env.START_TIMESTAMP);
  }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data && data.startTime && !isNaN(Number(data.startTime))) {
        console.log(`[Timer] Resumed persistent timer from state file: ${new Date(Number(data.startTime)).toISOString()}`);
        return Number(data.startTime);
      }
    }
  } catch (err) {
    console.warn('[Timer Warning] Could not read rpc_state.json:', err.message);
  }

  const newTime = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ startTime: newTime }, null, 2));
    console.log(`[Timer] Initialized persistent timer: ${new Date(newTime).toISOString()}`);
  } catch (err) {
    console.warn('[Timer Warning] Could not write rpc_state.json:', err.message);
  }
  return newTime;
}

const START_TIMESTAMP = getPersistentStartTime();

// ---------------------------------------------------------------------------
// 4. Token Discovery Engine (Handles any casing, quotes, or variable names)
// ---------------------------------------------------------------------------
function cleanToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let t = raw.trim();
  // Strip enclosing quotes if user pasted with quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function isDiscordToken(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim().replace(/^["']|["']$/g, '');
  // Discord tokens are 3 base64url segments separated by dots
  return /^[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{20,}$/.test(clean);
}

function discoverTokens() {
  const tokenSet = new Set();

  for (const [key, rawVal] of Object.entries(process.env)) {
    if (!rawVal) continue;
    const lowerKey = key.toLowerCase();

    // Key must include 'token' and must NOT be a cloud/system variable
    if (
      !lowerKey.includes('token') ||
      lowerKey.includes('path') ||
      lowerKey.startsWith('railway') ||
      lowerKey.startsWith('github') ||
      lowerKey.startsWith('gh_') ||
      lowerKey.startsWith('nixpacks') ||
      lowerKey.startsWith('csrf') ||
      lowerKey.startsWith('antigravity')
    ) {
      continue;
    }

    const val = cleanToken(rawVal);
    if (val && isDiscordToken(val)) {
      tokenSet.add(val);
    }
  }

  return Array.from(tokenSet);
}

// ---------------------------------------------------------------------------
// 5. Active HTTP Keep-Alive & Health Check Server (Starts Immediately)
// ---------------------------------------------------------------------------
const activeClients = new Map(); // token -> { client, tag, id, status, lastError }

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    const mem = process.memoryUsage();
    const accounts = Array.from(activeClients.values()).map(a => ({
      tag: a.tag || 'connecting...',
      id: a.id || 'unknown',
      status: a.status,
      error: a.lastError || null
    }));

    const responseData = {
      status: accounts.some(a => a.status === 'active') ? 'online' : 'waiting_or_connecting',
      tokens_detected: activeClients.size,
      connected_accounts: accounts,
      memory: {
        rss_mb: +(mem.rss / 1024 / 1024).toFixed(2),
        heap_used_mb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        threshold_mb: MEMORY_THRESHOLD_MB,
        cleaner_active: true
      },
      timer: {
        started_at: new Date(START_TIMESTAMP).toISOString(),
        elapsed_seconds: Math.floor((Date.now() - START_TIMESTAMP) / 1000)
      },
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData, null, 2));
  } else if (req.url === '/logo.png') {
    const logoPath = path.join(__dirname, 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(logoPath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Logo not found');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Bind to 0.0.0.0 so Railway reverse proxy can reach it without network block
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] Healthcheck & Keep-Alive server listening on 0.0.0.0:${PORT}`);
});

// ---------------------------------------------------------------------------
// 6. Memory Cleaner (< 0.4 GB)
// ---------------------------------------------------------------------------
function cleanMemory() {
  const mem = process.memoryUsage();
  const rssMB = (mem.rss / 1024 / 1024).toFixed(2);

  if (mem.rss >= MEMORY_THRESHOLD_BYTES) {
    console.warn(`[Memory Monitor] RSS reached ${rssMB} MB (Threshold: ${MEMORY_THRESHOLD_MB} MB). Purging memory...`);

    // Clear caches on all active clients
    for (const entry of activeClients.values()) {
      try {
        if (entry.client && entry.client.isReady()) {
          entry.client.users?.cache?.clear();
          entry.client.channels?.cache?.clear();
          entry.client.guilds?.cache?.clear();
        }
      } catch (err) {
        // Safe ignore
      }
    }

    // Trigger V8 Garbage Collection
    if (typeof global.gc === 'function') {
      try {
        global.gc();
        const postMem = process.memoryUsage();
        const postMB = (postMem.rss / 1024 / 1024).toFixed(2);
        console.log(`[Memory Cleaner] GC successful. RAM reduced from ${rssMB} MB to ${postMB} MB.`);
      } catch (err) {
        console.error('[Memory Cleaner Error]:', err.message);
      }
    }
  }
}

setInterval(cleanMemory, 30 * 1000);

// ---------------------------------------------------------------------------
// 7. Rich Presence Builder
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
    } catch (imgErr) {
      console.warn('[Presence Warning] Could not resolve external image asset:', imgErr.message);
      try {
        presence.setAssetsLargeImage(LARGE_IMAGE_URL);
      } catch {
        // Safe fallback if Discord rejects raw external URL
      }
    }
  }

  if (LARGE_IMAGE_TEXT) {
    presence.setAssetsLargeText(LARGE_IMAGE_TEXT);
  }

  if (BUTTON1_NAME && BUTTON1_URL) {
    try {
      presence.addButton(BUTTON1_NAME, BUTTON1_URL);
    } catch (err) {
      console.warn('[Presence Warning] Failed to add Button 1:', err.message);
    }
  }

  if (BUTTON2_NAME && BUTTON2_URL) {
    try {
      presence.addButton(BUTTON2_NAME, BUTTON2_URL);
    } catch (err) {
      console.warn('[Presence Warning] Failed to add Button 2:', err.message);
    }
  }

  return presence;
}

// ---------------------------------------------------------------------------
// 8. Discord Client Manager & Auto-Reconnect
// ---------------------------------------------------------------------------
function launchClient(token, index) {
  if (activeClients.has(token)) return;

  console.log(`[Client #${index + 1}] Initializing client connection...`);

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

  const record = {
    client,
    tag: null,
    id: null,
    status: 'connecting',
    lastError: null
  };

  activeClients.set(token, record);

  client.on('ready', async () => {
    record.tag = client.user.tag;
    record.id = client.user.id;
    record.status = 'active';
    record.lastError = null;
    console.log(`[Client #${index + 1}] Connected as ${client.user.tag} (ID: ${client.user.id})`);

    try {
      const presence = await buildPresence(client);
      client.user.setPresence({ activities: [presence] });
      console.log(`[Client #${index + 1}] RPC Live: ${ACTIVITY_TYPE} ${APP_NAME} | ${DETAILS} | ${STATE}`);
    } catch (err) {
      console.error(`[Client #${index + 1}] Presence set error:`, err.message);
    }

    // Refresh presence every 30 minutes
    setInterval(async () => {
      if (client.isReady()) {
        try {
          const presence = await buildPresence(client);
          client.user.setPresence({ activities: [presence] });
        } catch {}
      }
    }, 30 * 60 * 1000);
  });

  client.on('error', (err) => {
    console.error(`[Client #${index + 1} Error]:`, err.message);
    record.lastError = err.message;
  });

  client.on('rateLimit', (info) => {
    console.warn(`[Client #${index + 1} Rate Limit]: Encountered limit (${info.timeout}ms). Holding safely...`);
  });

  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[Client #${index + 1}] Shard ${shardId} disconnected (${event.code}). Reconnecting...`);
    record.status = 'reconnecting';
  });

  async function tryLogin() {
    try {
      await client.login(token);
    } catch (err) {
      console.error(`[Client #${index + 1} Login Failed]:`, err.message);
      record.status = 'login_failed';
      record.lastError = err.message;
      // Retry login in 60 seconds without crashing
      setTimeout(tryLogin, 60 * 1000);
    }
  }

  tryLogin();
}

// ---------------------------------------------------------------------------
// 9. Dynamic Token Detection Loop (Does NOT crash if tokens aren't entered yet)
// ---------------------------------------------------------------------------
function checkAndStartTokens() {
  const tokens = discoverTokens();

  if (tokens.length === 0) {
    if (activeClients.size === 0) {
      console.log('[Waiting for Tokens] No Discord tokens detected yet in Railway environment variables.');
      console.log('HTTP healthcheck is RUNNING to keep container alive. Add Discord_Token1 in Railway Variables to start.');
    }
    return;
  }

  tokens.forEach((tok, idx) => {
    if (!activeClients.has(tok)) {
      launchClient(tok, idx);
    }
  });
}

// Initial check
checkAndStartTokens();

// Check every 15 seconds so if user adds or updates variables, they start automatically
setInterval(checkAndStartTokens, 15 * 1000);

// ---------------------------------------------------------------------------
// 10. Graceful Shutdown
// ---------------------------------------------------------------------------
function handleShutdown(sig) {
  console.log(`\n[System] ${sig} signal received. Cleaning up...`);
  server.close();
  for (const entry of activeClients.values()) {
    try {
      entry.client.destroy();
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
