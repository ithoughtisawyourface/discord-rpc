require('dotenv').config();

// Polyfill global File for undici / Node 18/20 compatibility on Railway
if (typeof globalThis.File === 'undefined') {
  try {
    const { File } = require('node:buffer');
    if (File) globalThis.File = File;
  } catch {}
}

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

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH PREVENTION] Trapped Unhandled Rejection:', reason);
});

// ---------------------------------------------------------------------------
// 2. Configuration Settings
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Legacy values to ignore if leftover in Railway environment variables
const LEGACY_APP_NAMES = ['Liminal Space', 'City', 'Arcturus'];
const LEGACY_ACTIVITIES = ['PLAYING'];
const LEGACY_DETAILS = ['<3', 'Playing Factions'];
const LEGACY_STATES = ['Im still alive', 'play.arcturusmc.org'];
const LEGACY_IMAGES = [
  'https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif',
  'https://i.pinimg.com/736x/f1/a6/59/f1a6598e51b4659a5b903fa068dc9686.jpg',
  'https://cdn.discordapp.com/app-icons/1548379245787480074/68c28d1fde6e93537bdf84f4293fd45f.png'
];
const LEGACY_APP_IDS = ['1077283441369944227'];

const rawAppName = process.env.APP_NAME ? process.env.APP_NAME.trim() : null;
const APP_NAME = (rawAppName && !LEGACY_APP_NAMES.includes(rawAppName)) ? rawAppName : 'First Love';

function parseActivityType(val) {
  if (!val) return 3; // Default to WATCHING (3)
  const clean = val.toString().trim().toUpperCase();
  switch (clean) {
    case 'PLAYING':
    case '0':
      return 0;
    case 'STREAMING':
    case '1':
      return 1;
    case 'LISTENING':
    case '2':
      return 2;
    case 'WATCHING':
    case 'WATCING':
    case '3':
      return 3;
    case 'COMPETING':
    case '5':
      return 5;
    default:
      return isNaN(Number(clean)) ? 3 : Number(clean);
  }
}

const rawActivityType = process.env.ACTIVITY_TYPE ? process.env.ACTIVITY_TYPE.trim() : null;
const ACTIVITY_TYPE = (rawActivityType && !LEGACY_ACTIVITIES.includes(rawActivityType.toUpperCase()))
  ? parseActivityType(rawActivityType)
  : 3; // Default WATCHING

const rawDetails = process.env.DETAILS ? process.env.DETAILS.trim() : null;
const DETAILS = (rawDetails && !LEGACY_DETAILS.includes(rawDetails)) ? rawDetails : 'THE END';

const rawState = process.env.STATE ? process.env.STATE.trim() : null;
const STATE = (rawState && !LEGACY_STATES.includes(rawState)) ? rawState : 'End of The greatest chapter';

// Status mode (online, idle, dnd)
const rawStatus = (process.env.STATUS || process.env.ONLINE_STATUS || 'online').trim().toLowerCase();
const STATUS = ['online', 'idle', 'dnd'].includes(rawStatus) ? rawStatus : 'online';

const DEFAULT_LARGE_IMAGE = 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGpqNDUzeTJpZTd5ZWY0cjVlaXZjcTFneTdxdmc4eG42ejR2OHc4dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YXKXghuo1wEYWCjUpw/giphy.gif';
const FALLBACK_LARGE_IMAGE = 'https://media.giphy.com/media/YXKXghuo1wEYWCjUpw/giphy.gif';

const rawLargeImage = process.env.LARGE_IMAGE_URL ? process.env.LARGE_IMAGE_URL.trim() : null;
const LARGE_IMAGE_URL = (rawLargeImage && !LEGACY_IMAGES.includes(rawLargeImage)) ? rawLargeImage : DEFAULT_LARGE_IMAGE;

const LARGE_IMAGE_TEXT = process.env.LARGE_IMAGE_TEXT || 'First Love';
const BUTTON1_NAME = process.env.BUTTON1_NAME || '';
const BUTTON1_URL = process.env.BUTTON1_URL || '';
const BUTTON2_NAME = process.env.BUTTON2_NAME || '';
const BUTTON2_URL = process.env.BUTTON2_URL || '';

const rawAppId = process.env.APPLICATION_ID ? process.env.APPLICATION_ID.trim() : null;
const APPLICATION_ID = (rawAppId && !LEGACY_APP_IDS.includes(rawAppId)) ? rawAppId : '1548379245787480074';
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'f57dfc860d81a34113e9f676d2975ed37bbf9d7121c3c485cfbb22770b7c6ff9';

// ---------------------------------------------------------------------------
// Advanced Memory Cleaning Thresholds (Railway Free Tier: 512 MB safe)
// ---------------------------------------------------------------------------
const MEMORY_THRESHOLD_MB = 250; // Soft purge threshold (MB)
const MEMORY_EMERGENCY_MB = 380; // Emergency aggressive GC threshold (MB)
const MEMORY_THRESHOLD_BYTES = MEMORY_THRESHOLD_MB * 1024 * 1024;
const MEMORY_EMERGENCY_BYTES = MEMORY_EMERGENCY_MB * 1024 * 1024;

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
// 4. Token Discovery Engine (Supports Discord_Token1..4 and N simultaneous tokens)
// ---------------------------------------------------------------------------
function cleanToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let t = raw.trim();
  // Strip quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  // Strip accidental "Bot " prefix if user copied from developer portal
  if (t.toLowerCase().startsWith('bot ')) {
    t = t.slice(4).trim();
  }
  return t;
}

function isDiscordToken(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = cleanToken(token);
  // Discord user tokens are typically 59-90 characters with dot separators
  if (!clean || clean.length < 50) return false;
  return /^[A-Za-z0-9_\-\.]{50,}$/.test(clean);
}

function discoverTokens() {
  const tokenSet = new Set();

  // 1. Check indexed tokens in order: Discord_Token1, Discord_Token2, Discord_Token3, Discord_Token4 ... up to 10
  for (let i = 1; i <= 10; i++) {
    const keys = [
      `Discord_Token${i}`,
      `DISCORD_TOKEN${i}`,
      `DISCORD_TOKEN_${i}`,
      `discord_token${i}`,
      `Token${i}`,
      `TOKEN${i}`
    ];
    for (const k of keys) {
      if (process.env[k]) {
        const val = cleanToken(process.env[k]);
        if (val && isDiscordToken(val)) {
          tokenSet.add(val);
          break;
        }
      }
    }
  }

  // 2. Check comma/newline separated multi-token variable
  const multiVars = ['DISCORD_TOKENS', 'Discord_Tokens', 'TOKENS'];
  for (const mv of multiVars) {
    if (process.env[mv]) {
      const parts = process.env[mv].split(/[\r\n,;]+/);
      for (const p of parts) {
        const val = cleanToken(p);
        if (val && isDiscordToken(val)) {
          tokenSet.add(val);
        }
      }
    }
  }

  // 3. Scan remaining environment variables for any other tokens
  for (const [key, rawVal] of Object.entries(process.env)) {
    if (!rawVal) continue;
    const lowerKey = key.toLowerCase();

    // Must contain 'token' and must not be a cloud/system environment variable
    if (
      !lowerKey.includes('token') ||
      lowerKey.includes('path') ||
      lowerKey.startsWith('railway') ||
      lowerKey.startsWith('github') ||
      lowerKey.startsWith('gh_') ||
      lowerKey.startsWith('nixpacks') ||
      lowerKey.startsWith('csrf') ||
      lowerKey.startsWith('antigravity') ||
      lowerKey.startsWith('npm_')
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
// 5. Active HTTP Keep-Alive & Health Check Server
// ---------------------------------------------------------------------------
const activeClients = new Map(); // token -> { client, tag, id, status, lastError, connectedAt, ping }

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    const mem = process.memoryUsage();
    const accounts = Array.from(activeClients.values()).map(a => ({
      tag: a.tag || 'connecting...',
      id: a.id || 'unknown',
      status: a.status,
      ping: a.client?.ws?.ping >= 0 ? `${a.client.ws.ping}ms` : 'n/a',
      connected_at: a.connectedAt ? new Date(a.connectedAt).toISOString() : null,
      error: a.lastError || null
    }));

    const responseData = {
      status: accounts.some(a => a.status === 'active') ? 'online' : 'waiting_or_connecting',
      tokens_detected: activeClients.size,
      max_tokens_supported: '4+ simultaneous tokens',
      connected_accounts: accounts,
      presence: {
        app_name: APP_NAME,
        details: DETAILS,
        state: STATE,
        activity_type: ACTIVITY_TYPE === 3 ? 'WATCHING' : ACTIVITY_TYPE,
        status: STATUS
      },
      memory: {
        rss_mb: +(mem.rss / 1024 / 1024).toFixed(2),
        heap_used_mb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
        soft_threshold_mb: MEMORY_THRESHOLD_MB,
        emergency_threshold_mb: MEMORY_EMERGENCY_MB,
        cleaner_active: true,
        v8_gc_exposed: typeof global.gc === 'function'
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] Healthcheck & Keep-Alive server listening on 0.0.0.0:${PORT}`);
});

// ---------------------------------------------------------------------------
// 6. Proactive & Emergency Memory Cleaning System (< 250 MB Safe)
// ---------------------------------------------------------------------------
function purgeCaches() {
  for (const entry of activeClients.values()) {
    try {
      if (entry.client && entry.client.isReady()) {
        entry.client.users?.cache?.clear();
        entry.client.channels?.cache?.clear();
        entry.client.guilds?.cache?.clear();
        entry.client.relationships?.cache?.clear();
      }
    } catch {}
  }
}

function triggerGC() {
  if (typeof global.gc === 'function') {
    try {
      global.gc();
      return true;
    } catch (err) {
      console.error('[Memory Cleaner Error]:', err.message);
    }
  }
  return false;
}

// 6a. Proactive routine purge every 3 minutes (keeps RAM low continuously)
setInterval(() => {
  purgeCaches();
  triggerGC();
}, 3 * 60 * 1000);

// 6b. Emergency memory monitor every 20 seconds
function monitorMemory() {
  const mem = process.memoryUsage();
  const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);

  if (mem.rss >= MEMORY_THRESHOLD_BYTES) {
    console.warn(`[Memory Cleaner] RAM elevated at ${rssMB} MB (Threshold: ${MEMORY_THRESHOLD_MB} MB). Performing purge...`);
    purgeCaches();
    const gcSuccess = triggerGC();
    const postMem = process.memoryUsage();
    const postMB = +(postMem.rss / 1024 / 1024).toFixed(2);
    console.log(`[Memory Cleaner] Purge complete (GC: ${gcSuccess}). RAM: ${rssMB} MB -> ${postMB} MB.`);
  }
}

setInterval(monitorMemory, 20 * 1000);

// ---------------------------------------------------------------------------
// 7. Rich Presence Builder
// ---------------------------------------------------------------------------
let cachedExternalAsset = null;

async function buildPresence(client) {
  const presence = new RichPresence(client)
    .setApplicationId(APPLICATION_ID)
    .setType(ACTIVITY_TYPE)
    .setName(APP_NAME)
    .setStartTimestamp(START_TIMESTAMP);

  if (DETAILS) {
    presence.setDetails(DETAILS);
  }

  if (STATE) {
    presence.setState(STATE);
  }

  if (LARGE_IMAGE_URL) {
    try {
      // 1. Direct Discord CDN / App Icon / Media Proxy assets work natively for ALL accounts
      if (
        LARGE_IMAGE_URL.includes('cdn.discordapp.com') ||
        LARGE_IMAGE_URL.includes('media.discordapp.net') ||
        LARGE_IMAGE_URL.startsWith('mp:') ||
        /^[0-9]{17,19}$/.test(LARGE_IMAGE_URL)
      ) {
        presence.setAssetsLargeImage(LARGE_IMAGE_URL);
      } else if (cachedExternalAsset) {
        // 2. Reuse resolved external asset path if previously generated
        presence.setAssetsLargeImage(cachedExternalAsset);
      } else if (typeof RichPresence.getExternal === 'function') {
        // 3. Resolve external URL via owner client
        const externalAssets = await RichPresence.getExternal(client, APPLICATION_ID, LARGE_IMAGE_URL);
        if (externalAssets && externalAssets.length > 0 && externalAssets[0]?.external_asset_path) {
          cachedExternalAsset = externalAssets[0].external_asset_path;
          presence.setAssetsLargeImage(cachedExternalAsset);
        } else {
          presence.setAssetsLargeImage(LARGE_IMAGE_URL);
        }
      } else {
        presence.setAssetsLargeImage(LARGE_IMAGE_URL);
      }
    } catch (imgErr) {
      console.warn('[Presence Warning] Primary image failed:', imgErr.message);
      if (FALLBACK_LARGE_IMAGE && LARGE_IMAGE_URL !== FALLBACK_LARGE_IMAGE) {
        try {
          const fallbackAssets = await RichPresence.getExternal(client, APPLICATION_ID, FALLBACK_LARGE_IMAGE);
          if (fallbackAssets && fallbackAssets.length > 0 && fallbackAssets[0]?.external_asset_path) {
            cachedExternalAsset = fallbackAssets[0].external_asset_path;
            presence.setAssetsLargeImage(cachedExternalAsset);
          } else {
            presence.setAssetsLargeImage(FALLBACK_LARGE_IMAGE);
          }
        } catch (fbErr) {
          console.warn('[Presence Warning] Fallback image also failed:', fbErr.message);
          presence.setAssetsLargeImage(FALLBACK_LARGE_IMAGE);
        }
      } else if (cachedExternalAsset) {
        presence.setAssetsLargeImage(cachedExternalAsset);
      } else {
        presence.setAssetsLargeImage(FALLBACK_LARGE_IMAGE);
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
// 8. Discord Client Manager & Auto-Reconnect (Optimized for Low RAM)
// ---------------------------------------------------------------------------
function launchClient(token, index) {
  if (activeClients.has(token)) return;

  const clientNum = index + 1;
  console.log(`[Account #${clientNum}] Initializing client connection...`);

  const client = new Client({
    checkUpdate: false,
    autoRedo: true,
    ws: {
      properties: {
        $os: 'Windows',
        $browser: 'Discord Client',
        $device: 'desktop'
      }
    },
    // Heavy cache suppression: Keeps RAM under 30MB per active account!
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,
      GuildMemberManager: 0,
      UserManager: 0,
      ReactionManager: 0,
      StageInstanceManager: 0,
      ThreadManager: 0,
      PresenceManager: 0,
      GuildBanManager: 0,
      BaseGuildEmojiManager: 0,
      GuildInviteManager: 0,
      GuildScheduledEventManager: 0,
      ReactionUserManager: 0,
      VoiceStateManager: 0
    }),
    sweepers: {
      ...Options.defaultSweeperSettings,
      messages: { interval: 60, lifetime: 30 },
      threads: { interval: 60, lifetime: 30 }
    }
  });

  const record = {
    client,
    tag: null,
    id: null,
    status: 'connecting',
    lastError: null,
    connectedAt: null
  };

  activeClients.set(token, record);

  client.on('ready', async () => {
    record.tag = client.user.tag;
    record.id = client.user.id;
    record.status = 'active';
    record.lastError = null;
    record.connectedAt = Date.now();
    console.log(`[Account #${clientNum}] Connected as ${client.user.tag} (ID: ${client.user.id})`);

    async function applyPresence() {
      try {
        const presence = await buildPresence(client);
        client.user.setPresence({ status: STATUS, activities: [presence] });
        const typeNames = { 0: 'PLAYING', 1: 'STREAMING', 2: 'LISTENING', 3: 'WATCHING', 5: 'COMPETING' };
        const typeLabel = typeNames[ACTIVITY_TYPE] || ACTIVITY_TYPE;
        console.log(`[Account #${clientNum}] Live RPC: ${typeLabel} ${APP_NAME} (${DETAILS} | ${STATE}) [Status: ${STATUS}]`);
      } catch (err) {
        console.error(`[Account #${clientNum}] Presence error:`, err.message);
      }
    }

    await applyPresence();

    // Re-sync presence every 10 minutes so Discord never drops the activity
    setInterval(async () => {
      if (client.isReady()) {
        await applyPresence();
      }
    }, 10 * 60 * 1000);
  });

  client.on('error', (err) => {
    console.error(`[Account #${clientNum} Error]:`, err.message);
    record.lastError = err.message;
  });

  client.on('rateLimit', (info) => {
    console.warn(`[Account #${clientNum} Rate Limit]: Limit hit (${info.timeout}ms). Backing off safely...`);
  });

  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[Account #${clientNum}] Shard ${shardId} disconnected (${event.code}). Auto-reconnecting...`);
    record.status = 'reconnecting';
  });

  let retryDelay = 15; // Initial retry delay in seconds
  async function tryLogin() {
    try {
      await client.login(token);
    } catch (err) {
      console.error(`[Account #${clientNum} Login Failed]:`, err.message);
      record.status = 'login_failed';
      record.lastError = err.message;

      // Exponential backoff up to 120s to avoid rate limits
      const nextWait = Math.min(retryDelay, 120);
      retryDelay = Math.min(retryDelay * 1.5, 120);
      console.log(`[Account #${clientNum}] Retrying login in ${Math.round(nextWait)}s...`);
      setTimeout(tryLogin, nextWait * 1000);
    }
  }

  tryLogin();
}

// ---------------------------------------------------------------------------
// 9. Dynamic Multi-Token Discovery Loop
// ---------------------------------------------------------------------------
function checkAndStartTokens() {
  const tokens = discoverTokens();

  if (tokens.length === 0) {
    if (activeClients.size === 0) {
      console.log('[Waiting for Tokens] No Discord tokens detected yet in Railway environment variables.');
      console.log('HTTP healthcheck is RUNNING to keep container alive. Add Discord_Token1..4 in Railway Variables.');
    }
    return;
  }

  tokens.forEach((tok, idx) => {
    if (!activeClients.has(tok)) {
      launchClient(tok, idx);
    }
  });
}

// Initial discovery
checkAndStartTokens();

// Check every 15 seconds so if user adds Discord_Token2, 3, or 4 in Railway Variables, they start automatically!
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
