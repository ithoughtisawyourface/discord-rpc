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

In Railway under your service **"Variables"** tab, you can configure these variables (defaults for First Love are already built-in!):

| Variable | Default / Value | Description |
| :--- | :--- | :--- |
| `Discord_Token1` | `your_token_here` | First Discord Account Token (**Required**) |
| `Discord_Token2` | _(Optional)_ | Second Discord Account Token |
| `Discord_Token3` | _(Optional)_ | Third Discord Account Token |
| `APP_NAME` | `First Love` | Application / Game Name |
| `ACTIVITY_TYPE` | `WATCHING` | Activity type (`WATCHING`, `PLAYING`, `LISTENING`, `COMPETING`) |
| `DETAILS` | `THE END` | First line under title |
| `STATE` | `End of The greatest chapter` | Second line under title |
| `LARGE_IMAGE_URL` | `https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGpqNDUzeTJpZTd5ZWY0cjVlaXZjcTFneTdxdmc4eG42ejR2OHc4dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YXKXghuo1wEYWCjUpw/giphy.gif` | Main rich presence GIF / image URL |
| `LARGE_IMAGE_TEXT` | `First Love` | Hover tooltip for the large image |
| `BUTTON1_NAME` | _(Optional)_ | Name for Button 1 |
| `BUTTON1_URL` | _(Optional)_ | URL for Button 1 |
| `BUTTON2_NAME` | _(Optional)_ | Name for Button 2 |
| `BUTTON2_URL` | _(Optional)_ | URL for Button 2 |
| `APPLICATION_ID` | `1548379245787480074` | Discord Application ID for assets |
| `PUBLIC_KEY` | `f57dfc860d81a34113e9f676d2975ed37bbf9d7121c3c485cfbb22770b7c6ff9` | Discord Application Public Key |
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
Your `.env` is configured with the First Love RPC settings:
```env
Discord_Token1=your_token_here
APP_NAME=First Love
ACTIVITY_TYPE=WATCHING
DETAILS=THE END
STATE=End of The greatest chapter
LARGE_IMAGE_URL=https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGpqNDUzeTJpZTd5ZWY0cjVlaXZjcTFneTdxdmc4eG42ejR2OHc4dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/YXKXghuo1wEYWCjUpw/giphy.gif
LARGE_IMAGE_TEXT=First Love
APPLICATION_ID=1548379245787480074
PUBLIC_KEY=f57dfc860d81a34113e9f676d2975ed37bbf9d7121c3c485cfbb22770b7c6ff9
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
