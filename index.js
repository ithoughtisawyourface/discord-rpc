require('dotenv').config();

// Polyfill global File for undici / Node 18/20 compatibility on container hosts
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
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Legacy values to ignore if leftover in environment variables
const LEGACY_APP_NAMES = ['Liminal Space', 'City', 'Arcturus', 'First Love'];
const LEGACY_DETAILS = ['<3', 'Playing Factions', 'THE END'];
const LEGACY_STATES = ['Im still alive', 'play.arcturusmc.org', 'End of The greatest chapter'];
const LEGACY_APP_IDS = ['1077283441369944227'];

const rawAppName = process.env.APP_NAME ? process.env.APP_NAME.trim() : null;
const APP_NAME = (rawAppName && !LEGACY_APP_NAMES.includes(rawAppName)) ? rawAppName : 'Memories';

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
const ACTIVITY_TYPE = rawActivityType ? parseActivityType(rawActivityType) : 3; // Default WATCHING

const rawDetails = process.env.DETAILS ? process.env.DETAILS.trim() : null;
const DETAILS = (rawDetails && !LEGACY_DETAILS.includes(rawDetails)) ? rawDetails : 'Maybe in Another Life';

const rawState = process.env.STATE ? process.env.STATE.trim() : null;
const STATE = (rawState && !LEGACY_STATES.includes(rawState)) ? rawState : 'Its you and Me';

// Status mode (dnd, online, idle) - Default to dnd (Do Not Disturb) as requested
const rawStatus = (process.env.STATUS || process.env.ONLINE_STATUS || 'dnd').trim().toLowerCase();
const STATUS = ['dnd', 'online', 'idle'].includes(rawStatus) ? rawStatus : 'dnd';

// Alternating GIF image configurations
const DEFAULT_GIF_1 = 'https://media.giphy.com/media/GzG3Vhfv21tsgELhkr/giphy.gif';
const DEFAULT_GIF_2 = 'https://media.giphy.com/media/iEIQgnHgvBgcQfp1aZ/giphy.gif';

function getCycleImages() {
  const images = [];

  // Check indexed variables: LARGE_IMAGE_URL1, LARGE_IMAGE_URL2, etc.
  for (let i = 1; i <= 10; i++) {
    const val = process.env[`LARGE_IMAGE_URL${i}`];
    if (val && val.trim()) {
      images.push(val.trim());
    }
  }

  // Check comma-separated LARGE_IMAGE_URL or LARGE_IMAGES
  if (images.length === 0) {
    const combined = process.env.LARGE_IMAGE_URL || process.env.LARGE_IMAGES;
    if (combined && combined.trim()) {
      const parts = combined.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        images.push(...parts);
      }
    }
  }

  // Fallback to the user's 2 Giphy GIFs
  if (images.length === 0) {
    images.push(DEFAULT_GIF_1, DEFAULT_GIF_2);
  }

  return images;
}

const CYCLE_IMAGES = getCycleImages();
// Switch every 15 seconds by default (safely under Discord's 5/20s Gateway limit)
const rawInterval = parseInt(process.env.CYCLE_INTERVAL_SECONDS, 10);
const CYCLE_INTERVAL_MS = (!isNaN(rawInterval) && rawInterval >= 10 ? rawInterval : 15) * 1000;

const LARGE_IMAGE_TEXT = process.env.LARGE_IMAGE_TEXT || 'Memories';
const BUTTON1_NAME = process.env.BUTTON1_NAME || '';
const BUTTON1_URL = process.env.BUTTON1_URL || '';
const BUTTON2_NAME = process.env.BUTTON2_NAME || '';
const BUTTON2_URL = process.env.BUTTON2_URL || '';

const rawAppId = process.env.APPLICATION_ID ? process.env.APPLICATION_ID.trim() : null;
const APPLICATION_ID = (rawAppId && !LEGACY_APP_IDS.includes(rawAppId)) ? rawAppId : '1548379245787480074';
const PUBLIC_KEY = process.env.PUBLIC_KEY || 'f57dfc860d81a34113e9f676d2975ed37bbf9d7121c3c485cfbb22770b7c6ff9';

// ---------------------------------------------------------------------------
// 3. Advanced Memory Cleaning System (Optimized for Bot-Hosting & 10 Accounts)
// ---------------------------------------------------------------------------
const MEMORY_THRESHOLD_MB = 220; // Soft purge threshold (MB)
const MEMORY_EMERGENCY_MB = 350; // Emergency aggressive purge threshold (MB)
const MEMORY_THRESHOLD_BYTES = MEMORY_THRESHOLD_MB * 1024 * 1024;
const MEMORY_EMERGENCY_BYTES = MEMORY_EMERGENCY_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// 4. Persistent Elapsed Timer (Continuously increments, never resets)
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
// 5. Token Discovery Engine (Supports up to 10+ simultaneous personal accounts)
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

  // 1. Check indexed tokens in order: Discord_Token1 through Discord_Token15
  for (let i = 1; i <= 15; i++) {
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
// 6. Active HTTP Keep-Alive & Health Check Server
// ---------------------------------------------------------------------------
const activeClients = new Map(); // token -> { client, tag, id, status, lastError, connectedAt }
let currentImageIndex = 0;

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
      max_tokens_supported: '10+ simultaneous personal accounts',
      connected_accounts: accounts,
      presence: {
        app_name: APP_NAME,
        details: DETAILS,
        state: STATE,
        activity_type: ACTIVITY_TYPE === 3 ? 'WATCHING' : ACTIVITY_TYPE,
        status: STATUS,
        active_gif_index: currentImageIndex + 1,
        total_gifs: CYCLE_IMAGES.length,
        current_gif_url: CYCLE_IMAGES[currentImageIndex]
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
// 7. Proactive Cache Purging & Memory Cleaner (< 220 MB Safe for 10 Accounts)
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

// 7a. Proactive routine purge every 2 minutes
setInterval(() => {
  purgeCaches();
  triggerGC();
}, 2 * 60 * 1000);

// 7b. Emergency memory monitor every 20 seconds
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
// 8. Rich Presence Builder with Alternating Large Image GIFs
// ---------------------------------------------------------------------------
const resolvedExternalAssetMap = new Map(); // rawUrl -> external_asset_path

async function resolveAsset(client, rawUrl) {
  if (!rawUrl) return null;
  if (resolvedExternalAssetMap.has(rawUrl)) {
    return resolvedExternalAssetMap.get(rawUrl);
  }

  // Native Discord CDN / media proxy assets work directly
  if (
    rawUrl.includes('cdn.discordapp.com') ||
    rawUrl.includes('media.discordapp.net') ||
    rawUrl.startsWith('mp:') ||
    /^[0-9]{17,19}$/.test(rawUrl)
  ) {
    resolvedExternalAssetMap.set(rawUrl, rawUrl);
    return rawUrl;
  }

  // Resolve external URL via client
  if (typeof RichPresence.getExternal === 'function') {
    try {
      const externalAssets = await RichPresence.getExternal(client, APPLICATION_ID, rawUrl);
      if (externalAssets && externalAssets.length > 0 && externalAssets[0]?.external_asset_path) {
        const resolved = externalAssets[0].external_asset_path;
        resolvedExternalAssetMap.set(rawUrl, resolved);
        return resolved;
      }
    } catch (err) {
      console.warn(`[Asset Warning] External resolution failed for ${rawUrl}:`, err.message);
    }
  }

  return rawUrl;
}

async function buildPresence(client, imageIdx = 0) {
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

  if (CYCLE_IMAGES.length > 0) {
    const currentUrl = CYCLE_IMAGES[imageIdx % CYCLE_IMAGES.length];
    try {
      const asset = await resolveAsset(client, currentUrl);
      if (asset) {
        presence.setAssetsLargeImage(asset);
      }
    } catch {
      presence.setAssetsLargeImage(currentUrl);
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
// 9. Synchronized GIF Alternating Loop Across All Active Accounts
// ---------------------------------------------------------------------------
async function syncPresenceForAllClients() {
  if (activeClients.size === 0) return;

  // Advance to next GIF in sequence
  if (CYCLE_IMAGES.length > 1) {
    currentImageIndex = (currentImageIndex + 1) % CYCLE_IMAGES.length;
  }

  for (const [token, record] of activeClients.entries()) {
    if (record.client && record.client.isReady()) {
      try {
        const presence = await buildPresence(record.client, currentImageIndex);
        record.client.user.setPresence({ status: STATUS, activities: [presence] });
      } catch (err) {
        // Suppress transient rate limit or network glitches during cycling
      }
    }
  }
}

// Cycle between GIF 1 and GIF 2 every 15 seconds
if (CYCLE_IMAGES.length > 1) {
  setInterval(syncPresenceForAllClients, CYCLE_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// 10. Discord Client Manager & Auto-Reconnect (Optimized for 10 Accounts)
// ---------------------------------------------------------------------------
function launchClient(token, index) {
  if (activeClients.has(token)) return;

  const clientNum = index + 1;
  console.log(`[Account #${clientNum}] Initializing personal account connection...`);

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
    // Complete cache suppression: keeps RAM footprint < 20MB per account!
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

    // Set initial presence immediately with current GIF
    try {
      const presence = await buildPresence(client, currentImageIndex);
      client.user.setPresence({ status: STATUS, activities: [presence] });
      const typeNames = { 0: 'PLAYING', 1: 'STREAMING', 2: 'LISTENING', 3: 'WATCHING', 5: 'COMPETING' };
      const typeLabel = typeNames[ACTIVITY_TYPE] || ACTIVITY_TYPE;
      console.log(`[Account #${clientNum}] Live RPC: ${typeLabel} ${APP_NAME} (${DETAILS} | ${STATE}) [Status: ${STATUS.toUpperCase()}]`);
      console.log(`[Account #${clientNum}] Cycling ${CYCLE_IMAGES.length} GIFs every ${CYCLE_INTERVAL_MS / 1000}s`);
    } catch (err) {
      console.error(`[Account #${clientNum}] Presence error:`, err.message);
    }
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
// 11. Dynamic Multi-Token Discovery Loop (10 Account Slots)
// ---------------------------------------------------------------------------
function checkAndStartTokens() {
  const tokens = discoverTokens();

  if (tokens.length === 0) {
    if (activeClients.size === 0) {
      console.log('[Waiting for Tokens] No Discord tokens detected yet in environment variables.');
      console.log('HTTP keep-alive is RUNNING to keep the service active. Add Discord_Token1..10 in your variables.');
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

// Check every 15 seconds so if user adds Discord_Token2..10, they start automatically without restarts!
setInterval(checkAndStartTokens, 15 * 1000);

// ---------------------------------------------------------------------------
// 12. Graceful Shutdown
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
