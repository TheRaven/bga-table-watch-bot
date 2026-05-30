export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10);
export const MAX_FAIL_COUNT = parseInt(process.env.MAX_FAIL_COUNT || '3', 10);

export const NUMBER_EMOJIS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
export const LOCK_EMOJI = '🔒';
export const LOADING_EMOJI = '⏳';

export const BGA_LINK_RE = /https?:\/\/bga\.li\/t\/(\d+)|https?:\/\/\w+\.boardgamearena\.com\/gamepanel\?[^\s]*table=(\d+)/;

export const BGA_ORIGIN = 'https://en.boardgamearena.com';
export const BGA_TABLE_URL = `${BGA_ORIGIN}/table`;
export const BGA_TABLE_INFO_URL = `${BGA_ORIGIN}/table/table/tableinfos.html`;
