# Discord RPC Selfbot (Memories - 24/7 Hosting Ready)

A custom Discord Rich Presence (RPC) selfbot designed to display custom activities with **alternating GIFs**, multi-account broadcasting, and run 24/7 on **[Bot-Hosting.net](https://bot-hosting.net)**, **[Railway](https://railway.app/)**, or any VPS.

---

## 🌟 Features

- **10+ Multi-Account Support**: Broadcasts simultaneously to up to 10+ Discord personal accounts (`Discord_Token1` through `Discord_Token10`).
- **Alternating Large Image GIFs**: Automatically cycles between GIF 1 and GIF 2 (or more) in a continuous loop every 15 seconds without hitting Discord rate limits.
- **Continuous Persistent Timer**: The elapsed timer continuously counts up from the start time and never resets to 0 across restarts or redeployments.
- **Bot-Hosting & Low-RAM Cleaning System**: Aggressive cache stripping (zero caches for guilds, members, channels, messages) and proactive 2-minute memory purging keep RAM under 20 MB per account!
- **24/7 Keep-Alive**: Built-in HTTP healthcheck server on port `3000` (or dynamic `$PORT`) reporting live account statuses, active GIF index, and memory stats.

---

## ⚙️ Configuration & Environment Variables

| Variable | Default / Value | Description |
| :--- | :--- | :--- |
| `Discord_Token1` | `your_token_here` | 1st Account Token (**Required**) |
| `Discord_Token2` .. `Discord_Token10` | _(Optional)_ | 2nd through 10th Account Tokens |
| `STATUS` | `dnd` | Discord Status (`dnd` for Do Not Disturb, `online`, `idle`) |
| `APP_NAME` | `Memories` | Application / Game Name |
| `ACTIVITY_TYPE` | `WATCHING` | Activity type (`WATCHING`, `PLAYING`, `STREAMING`, `LISTENING`) |
| `DETAILS` | `Maybe in Another Life` | First line under title |
| `STATE` | `Its you and Me` | Second line under title |
| `LARGE_IMAGE_URL1` | `https://media.giphy.com/media/GzG3Vhfv21tsgELhkr/giphy.gif` | First cycling GIF URL |
| `LARGE_IMAGE_URL2` | `https://media.giphy.com/media/iEIQgnHgvBgcQfp1aZ/giphy.gif` | Second cycling GIF URL |
| `CYCLE_INTERVAL_SECONDS` | `15` | Seconds between alternating GIFs (minimum 10s) |
| `LARGE_IMAGE_TEXT` | `Memories` | Hover tooltip for the large image |
| `BUTTON1_NAME` | _(Optional)_ | Name for Button 1 |
| `BUTTON1_URL` | _(Optional)_ | URL for Button 1 |
| `BUTTON2_NAME` | _(Optional)_ | Name for Button 2 |
| `BUTTON2_URL` | _(Optional)_ | URL for Button 2 |
| `APPLICATION_ID` | `1548379245787480074` | Discord Application ID |
| `PORT` | `3000` | Web server port for health check & keep-alive |

---

## ☁️ Deploying on Bot-Hosting.net

1. Log into your **[Bot-Hosting.net](https://bot-hosting.net/)** dashboard.
2. Link your GitHub account or upload this repository.
3. Under the server **Environment Variables** / **Startup** tab:
   - Add `Discord_Token1` with your Discord token (and `Discord_Token2` .. `10` for other accounts).
   *(All other values: Memories, the 2 GIFs, DND status, and Details have built-in defaults!)*
4. Click **Start**! The bot will start cycling your GIFs and broadcasting your status 24/7.
