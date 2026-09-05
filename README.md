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

In Railway under your service **"Variables"** tab, add:

| Variable | Description |
| :--- | :--- |
| `Discord_Token1` | First Discord Account Token |
| `Discord_TOken2` | Second Discord Account Token |
| `Discord_Token3` | Third Discord Account Token |
| `APP_NAME` | `Liminal Space` |
| `ACTIVITY_TYPE` | `WATCHING` |
| `DETAILS` | `<3` |
| `STATE` | `Im still alive` |
| `LARGE_IMAGE_URL` | `https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif` |
| `LARGE_IMAGE_TEXT` | `Liminal Space` |

---

## 🚀 Running Locally

### 1. Requirements
- Node.js 18+ installed

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Make sure `.env` exists (it is already pre-configured):
```env
DISCORD_TOKEN=your_token_here
APP_NAME=Liminal Space
ACTIVITY_TYPE=WATCHING
DETAILS=<3
STATE=Im still alive
LARGE_IMAGE_URL=https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif
LARGE_IMAGE_TEXT=Liminal Space
PORT=3000
```

### 4. Start the Bot
```bash
npm start
```
Once connected, you will see your Discord account online with the custom Rich Presence!

---

## ☁️ Deploying 24/7 on Railway via GitHub

### Step 1: Push to GitHub
1. Create a **Private** repository on [GitHub](https://github.com/new).
2. Initialize and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Discord RPC Selfbot"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
   > **Note**: `.gitignore` is already set up to **never** upload your `.env` file or Discord token to GitHub.

---

### Step 2: Deploy to Railway
1. Go to [Railway.app](https://railway.app/) and log in (or sign up with GitHub).
2. Click **"+ New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository.
4. Click on the newly created service in Railway, go to the **"Variables"** tab, and add your environment variables:
   - `DISCORD_TOKEN`: `Your Discord Token`
   - `APP_NAME`: `City`
   - `ACTIVITY_TYPE`: `WATCHING`
   - `DETAILS`: `<3`
   - `STATE`: `Im still alive`
   - `LARGE_IMAGE_URL`: `https://i.pinimg.com/originals/27/ed/a4/27eda4c49c4fa03797eefa8c406e8a9a.gif`
   - `LARGE_IMAGE_TEXT`: `City`
5. Railway will automatically build and launch the bot!
6. (Optional) In Railway under **Settings -> Networking**, click **Generate Domain**. You can copy this URL into a free uptime monitor (like [UptimeRobot](https://uptimerobot.com/)) pointing to `https://your-domain.up.railway.app/health` to keep your service pinged 24/7.
