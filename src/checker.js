import { NUMBER_EMOJIS, LOCK_EMOJI, CLOSED_EMOJI, MAX_FAIL_COUNT, REMINDER_SCHEDULE_MINUTES } from './config.js';
import { getTablesByMessageId, getActiveTables, deleteTable, incrementFailCount, resetFailCount, getFailCount, countByMessageId, deleteByMessageId, markReminded } from './db.js';
import { fetchTableInfo, getSeatsInfo } from './bga.js';
import { clearBotReactions, setReaction, sendReminder } from './discord.js';

export async function checkTablesForMessage(message, botUserId) {
  const rows = getTablesByMessageId.all(message.id);

  if (rows.length === 0) return;

  let seatsLeft = null;
  let removalReason = null; // 'full', 'started', or 'error'
  const toRemove = [];

  for (const row of rows) {
    try {
      const tableData = await fetchTableInfo(row.table_id);
      const info = getSeatsInfo(tableData);

      if (info.hasStarted) {
        console.log(`Table ${row.table_id}: STARTED, removing`);
        toRemove.push(row.id);
        removalReason = 'started';
      } else if (info.isFull) {
        console.log(`Table ${row.table_id}: FULL, removing`);
        toRemove.push(row.id);
        removalReason = 'full';
      } else {
        resetFailCount.run(row.id);
        seatsLeft = info.seatsLeft;
        console.log(`Table ${row.table_id}: ${info.seatsLeft} seats left`);

        // Send reminder on schedule: 45min, 1h, 2h, 4h, 8h then stop
        if (row.reminder_count < REMINDER_SCHEDULE_MINUTES.length) {
          const delay = REMINDER_SCHEDULE_MINUTES[row.reminder_count];
          const sinceTime = row.last_reminded_at
            ? new Date(row.last_reminded_at + 'Z')
            : new Date(row.created_at + 'Z');
          const minutesElapsed = (Date.now() - sinceTime.getTime()) / 60000;

          if (minutesElapsed >= delay) {
            await sendReminder(message, info.seatsLeft, row.bga_url);
            markReminded.run(row.id);
            console.log(`Table ${row.table_id}: reminder #${row.reminder_count + 1} sent`);
          }
        }
      }
    } catch (err) {
      console.error(`Error checking table ${row.table_id}:`, err.message);
      incrementFailCount.run(row.id);
      const updated = getFailCount.get(row.id);
      if (updated.fail_count >= MAX_FAIL_COUNT) {
        console.log(`Table ${row.table_id}: unreachable for ${updated.fail_count} checks, removing`);
        toRemove.push(row.id);
        removalReason = 'error';
      }
    }
  }

  for (const id of toRemove) {
    deleteTable.run(id);
  }

  const remaining = countByMessageId.get(message.id);

  await clearBotReactions(message, botUserId);

  if (remaining.count === 0) {
    if (removalReason === 'error') {
      await setReaction(message, CLOSED_EMOJI);
    } else {
      await setReaction(message, LOCK_EMOJI);
    }
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
