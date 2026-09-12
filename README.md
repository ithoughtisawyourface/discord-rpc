# Discord RPC Selfbot (24/7 Hosting Ready)

A custom Discord Rich Presence (RPC) selfbot designed to display custom activities and run 24/7 on [Railway](https://railway.app/) or any host.

---

## 🌟 Features

- **Multi-Token Support**: Broadcasts to multiple Discord accounts simultaneously (`Discord_Token1`, `Discord_TOken2`, `Discord_Token3`).
- **Memory Cleaner**: Monitors RAM usage and automatically frees memory and triggers garbage collection whenever memory approaches 0.4 GB (Railway free tier safe!).
- **Persistent Elapsed Timer**: The timer continuously counts up from the initial start time. Even across restarts or crashes, the timer never resets to 0.
- **24/7 Keep-Alive**: Built-in HTTP healthcheck server on port `3000` (or Railway dynamic `$PORT`).

---

## 🚀 Railway Deployment Variables

In Railway under your service **"Variables"** tab, you can configure these variables (defaults for Arcturus are already built-in!):

| Variable | Default / Value | Description |
| :--- | :--- | :--- |
| `Discord_Token1` | `your_token_here` | First Discord Account Token (**Required**) |
| `Discord_Token2` | _(Optional)_ | Second Discord Account Token |
| `Discord_Token3` | _(Optional)_ | Third Discord Account Token |
| `APP_NAME` | `Arcturus` | Application / Game Name |
| `ACTIVITY_TYPE` | `PLAYING` | Activity type (`PLAYING`, `WATCHING`, `LISTENING`, `COMPETING`) |
| `DETAILS` | `Playing Factions` | First line under game title |
| `STATE` | _(Optional)_ | Second line under game title |
| `LARGE_IMAGE_URL` | `https://i.pinimg.com/736x/b9/f5/59/b9f559f80e635d1558e4ca732b15ef2e.jpg` | Main rich presence image URL |
| `LARGE_IMAGE_TEXT` | `Arcturus` | Hover tooltip for the large image |
| `BUTTON1_NAME` | `Discord 💎` | Name for Button 1 |
| `BUTTON1_URL` | `https://discord.com/invite/DTR6serkeM` | URL for Button 1 |
| `BUTTON2_NAME` | `Web 💫` | Name for Button 2 |
| `BUTTON2_URL` | `https://www.arcturusmc.org/` | URL for Button 2 |
| `PORT` | `3000` | Web server port for health check |

---

## 🚀 Running Locally

### 1. Requirements
- Node.js 18+ installed

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Your `.env` is already configured with the Arcturus RPC settings and your Discord token:
```env
Discord_Token1=your_token_here
APP_NAME=Arcturus
ACTIVITY_TYPE=PLAYING
DETAILS=Playing Factions
STATE=
LARGE_IMAGE_URL=https://i.pinimg.com/736x/b9/f5/59/b9f559f80e635d1558e4ca732b15ef2e.jpg
LARGE_IMAGE_TEXT=Arcturus
BUTTON1_NAME=Discord 💎
BUTTON1_URL=https://discord.com/invite/DTR6serkeM
BUTTON2_NAME=Web 💫
BUTTON2_URL=https://www.arcturusmc.org/
PORT=3000
```

### 4. Start the Bot
```bash
npm start
```
Once connected, you will see your Discord account online with the custom Rich Presence!

---

## ☁️ Deploying 24/7 on Railway via GitHub

### Step 1: Push Changes to GitHub
Since your local repository is already linked to GitHub (`origin main`), commit and push your changes:
```bash
git add index.js .env.example README.md
git commit -m "Update RPC to Arcturus with custom buttons"
git push
```
> **Note**: `.gitignore` is already set up to **never** upload your `.env` file or Discord token to GitHub.

---

### Step 2: Deploy to Railway
1. Go to [Railway.app](https://railway.app/) and open your project (or click **"New Project"** -> **"Deploy from GitHub repo"**).
2. Select your repository: `discord-rpc`.
3. Go to the **"Variables"** tab and make sure you add your Discord Token:
   - `Discord_Token1`: `<your_discord_token>`
   *(All other values like APP_NAME, details, image, and buttons have built-in defaults in the code, or you can customize them in the Variables tab)*.
4. Railway will automatically build and start the service with Nixpacks/Node!
5. (Optional) Under **Settings -> Networking**, click **Generate Domain** to get a public URL like `https://your-app.up.railway.app` which keeps the container active with `/health`.
