# BGA Table Watch Bot

A Discord bot that monitors Board Game Arena table links and shows seat availability via reactions.

## How it works

1. A server admin runs `/bga-watch` in a channel to start monitoring it
2. When someone posts a BGA table link, the bot tracks it
3. The bot periodically checks each table's availability and reacts to the message:
   - 1️⃣–9️⃣ — number of seats remaining
   - 🔒 — table is full or the game has started

Full tables are automatically removed from tracking. Unreachable tables are removed after a configurable number of failed attempts.

## Supported link formats

- `https://bga.li/t/123456789`
- `https://en.boardgamearena.com/gamepanel?game=terraformingmars&table=123456789`

## Setup

### 1. Create a Discord bot

- Go to the [Discord Developer Portal](https://discord.com/developers/applications)
- Create a new application and go to the **Bot** tab
- Reset the token and copy it
- Enable **Message Content Intent** under Privileged Gateway Intents

### 2. Invite the bot

Go to **OAuth2 → URL Generator** and select:
- Scopes: `bot`, `applications.commands`
- Permissions: `View Channels`, `Read Message History`, `Send Messages`, `Add Reactions`, `Manage Messages`

Open the generated URL and add the bot to your server.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your bot token:

```
DISCORD_TOKEN=your_bot_token_here
CHECK_INTERVAL_SECONDS=60
MAX_FAIL_COUNT=3
```

### 4. Install and run

```bash
npm install
npm start
```

### 5. In Discord

Run `/bga-watch` in the channel you want the bot to monitor.

## Slash commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/bga-watch` | Manage Channels | Watch the current channel for BGA links |
| `/bga-unwatch` | Manage Channels | Stop watching in this server |

## Project structure

```
bot.js              → entrypoint: Discord client, events, slash commands
src/
  config.js         → env vars, constants, BGA URLs
  db.js             → SQLite setup and prepared statements
  bga.js            → BGA scraping: fetch table info, parse seats
  checker.js        → polling logic: check tables, update reactions
```
