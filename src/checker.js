import { NUMBER_EMOJIS, LOCK_EMOJI, MAX_FAIL_COUNT } from './config.js';
import { getTablesByMessageId, getActiveTables, deleteTable, incrementFailCount, resetFailCount, getFailCount, countByMessageId, deleteByMessageId } from './db.js';
import { fetchTableInfo, getSeatsInfo } from './bga.js';

async function clearBotReactions(message, botUserId) {
  try {
    const reactions = message.reactions.cache;
    for (const [, reaction] of reactions) {
      const users = await reaction.users.fetch();
      if (users.has(botUserId)) {
        await reaction.users.remove(botUserId);
      }
    }
  } catch (err) {
    console.error('Error clearing reactions:', err.message);
  }
}

async function setReaction(message, emoji) {
  try {
    await message.react(emoji);
  } catch (err) {
    console.error(`Error setting reaction ${emoji}:`, err.message);
  }
}

export async function checkTablesForMessage(message, botUserId) {
  const rows = getTablesByMessageId.all(message.id);

  if (rows.length === 0) return;

  let seatsLeft = null;
  const toRemove = [];

  for (const row of rows) {
    try {
      const tableData = await fetchTableInfo(row.table_id);
      const info = getSeatsInfo(tableData);

      if (info.isFull) {
        console.log(`Table ${row.table_id}: FULL, removing`);
        toRemove.push(row.id);
      } else {
        resetFailCount.run(row.id);
        seatsLeft = info.seatsLeft;
        console.log(`Table ${row.table_id}: ${info.seatsLeft} seats left`);
      }
    } catch (err) {
      console.error(`Error checking table ${row.table_id}:`, err.message);
      incrementFailCount.run(row.id);
      const updated = getFailCount.get(row.id);
      if (updated.fail_count >= MAX_FAIL_COUNT) {
        console.log(`Table ${row.table_id}: unreachable for ${updated.fail_count} checks, removing`);
        toRemove.push(row.id);
      }
    }
  }

  for (const id of toRemove) {
    deleteTable.run(id);
  }

  const remaining = countByMessageId.get(message.id);

  await clearBotReactions(message, botUserId);

  if (remaining.count === 0) {
    await setReaction(message, LOCK_EMOJI);
  } else if (seatsLeft !== null && seatsLeft >= 0 && seatsLeft <= 9) {
    await setReaction(message, NUMBER_EMOJIS[seatsLeft]);
  }
}

export async function checkAllTables(client) {
  const rows = getActiveTables.all();
  if (rows.length === 0) return;

  const byMessage = new Map();
  for (const row of rows) {
    if (!byMessage.has(row.message_id)) {
      byMessage.set(row.message_id, []);
    }
    byMessage.get(row.message_id).push(row);
  }

  await Promise.all([...byMessage.entries()].map(async ([messageId, tableRows]) => {
    const row = tableRows[0];
    try {
      const channel = await client.channels.fetch(row.channel_id);
      const message = await channel.messages.fetch(messageId);

      await checkTablesForMessage(message, client.user.id);
    } catch (err) {
      console.error(`Error fetching message ${messageId}:`, err.message);
      console.log(`Message ${messageId} deleted or inaccessible, removing tracked tables`);
      deleteByMessageId.run(messageId);
    }
  }));
}
