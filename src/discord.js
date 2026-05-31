import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { DISCORD_TOKEN, CHECK_INTERVAL, BGA_LINK_RE } from './config.js';
import { setWatchedChannel, getWatchedChannel, removeWatchedChannel, insertTable } from './db.js';
import { extractTableId } from './bga.js';
import { checkTablesForMessage, checkAllTables } from './checker.js';

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

async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands.map(c => c.toJSON()),
  });
  console.log('Slash commands registered');
}

// --- Event handlers ---

export async function onClientReady(client) {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands(client);

  console.log(`Check interval: ${CHECK_INTERVAL}s`);
  checkAllTables(client);
  setInterval(() => checkAllTables(client), CHECK_INTERVAL * 1000);
}

export async function onInteractionCreate(interaction) {
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
}

export async function onGuildCreate(guild) {
  const channel = guild.systemChannel
    || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has('SendMessages'));

  if (channel) {
    await channel.send(
      `Hey! Use \`/bga-watch\` in the channel where you want me to track Board Game Arena links.`
    );
  }
}

export async function onMessageCreate(message, client) {
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
}
