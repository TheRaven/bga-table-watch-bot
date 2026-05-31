import { createServer } from 'node:http';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { DISCORD_TOKEN } from './src/config.js';
import { onClientReady, onInteractionCreate, onGuildCreate, onMessageCreate } from './src/discord.js';

// --- Discord client ---

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction],
});

client.once('clientReady', () => onClientReady(client));
client.on('interactionCreate', onInteractionCreate);
client.on('guildCreate', onGuildCreate);
client.on('messageCreate', (message) => onMessageCreate(message, client));

// --- Health check server ---

const PORT = process.env.PORT || 80;

createServer((req, res) => {
  if (req.url === '/health') {
    console.log(`Health check from ${req.socket.remoteAddress}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => {
  console.log(`Health check listening on port ${PORT}`);
});

client.login(DISCORD_TOKEN);
