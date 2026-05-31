import { createServer } from 'node:http';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { DISCORD_TOKEN, CHECK_INTERVAL, BGA_LINK_RE } from './src/config.js';
import { setWatchedChannel, getWatchedChannel, removeWatchedChannel, insertTable } from './src/db.js';
import { extractTableId } from './src/bga.js';
import { checkTablesForMessage, checkAllTables } from './src/checker.js';

// --- Slash commands ---

const commands = [
  new SlashCommandBuilder()
    .setName('bga-watch')
    .setDescription('Watch this channel for Board Game Arena links')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('bga-unwatch')
    .setDescription('Stop watching for Board Game Arena links in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands.map(c => c.toJSON()),
  });
  console.log('Slash commands registered');
}

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

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();

  console.log(`Check interval: ${CHECK_INTERVAL}s`);
  checkAllTables(client);
  setInterval(() => checkAllTables(client), CHECK_INTERVAL * 1000);
});

// --- Slash command handling ---

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'bga-watch') {
      setWatchedChannel.run(interaction.guildId, interaction.channelId);
      await interaction.reply(`Now watching this channel for BGA links.`);
      console.log(`Watching channel ${interaction.channelId} in guild ${interaction.guildId}`);
    }

    if (interaction.commandName === 'bga-unwatch') {
      removeWatchedChannel.run(interaction.guildId);
      await interaction.reply(`Stopped watching for BGA links in this server.`);
      console.log(`Unwatched guild ${interaction.guildId}`);
    }
  } catch (err) {
    console.error('Error handling interaction:', err.message);
  }
});

// --- Welcome message on join ---

client.on('guildCreate', async (guild) => {
  const channel = guild.systemChannel
    || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has('SendMessages'));

  if (channel) {
    await channel.send(
      `Hey! Use \`/bga-watch\` in the channel where you want me to track Board Game Arena links.`
    );
  }
});

// --- Message watching ---

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const watched = getWatchedChannel.get(message.guildId);
  if (!watched || watched.channel_id !== message.channel.id) return;

  const match = message.content.match(BGA_LINK_RE);
  if (!match) return;

  const link = match[0];
  const tableId = extractTableId(link);
  if (!tableId) return;

  const result = insertTable.run(
    message.id,
    message.channel.id,
    message.guild.id,
    link,
    tableId
  );

  if (result.changes > 0) {
    console.log(`Tracked new BGA table: ${tableId} from message ${message.id}`);
  }

  await checkTablesForMessage(message, client.user.id);
});

// --- Health check server ---

const PORT = process.env.PORT || 80;

createServer((req, res) => {
  if (req.url === '/health') {
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
