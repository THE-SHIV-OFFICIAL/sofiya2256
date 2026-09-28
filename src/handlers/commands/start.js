const os = require('os');
const { Markup } = require('telegraf');
const config = require('../../config/index');
const { formatDuration, escapeHtml } = require('../../utils/helpers');
const { getGroup } = require('../../utils/groupSettings');
const { ff } = require('../../utils/font');
const { logEvent } = require('../../services/loggingService');

const STICKER_SET = process.env.START_STICKER_SET || 'Koylakoyla_by_fStikBot';

const LOADING_FRAMES = [
  '<tg-emoji emoji-id="5350444080084033572">✨</tg-emoji> нℓσ вαву <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>',
  `${ff('loading')}.`,
  `${ff('loading')}..`,
  `${ff('loading')}...`,
  '<tg-emoji emoji-id="6267058648728474885">🔥</tg-emoji> вєтα',
  '<tg-emoji emoji-id="6267058648728474885">🔥</tg-emoji> вєтα вσт',
  '<tg-emoji emoji-id="6129739490484294910">👑</tg-emoji> вєтα вσт нυв',
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> ѕтαятє∂ <tg-emoji emoji-id="6129739490484294910">👑</tg-emoji>',
];

const FRAME_DELAY_MS  = 220;
const STICKER_HOLD_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getFirstSticker(telegram, stickerSetName) {
  try {
    const stickerSet = await telegram.getStickerSet(stickerSetName);
    if (stickerSet && stickerSet.stickers && stickerSet.stickers.length > 0) {
      return stickerSet.stickers[0].file_id;
    }
  } catch (err) {
    console.error('[startCommand] Failed to fetch sticker set:', err.message);
  }
  return null;
}

async function playStartAnimation(ctx) {
  try {
    const fileId = await getFirstSticker(ctx.telegram, STICKER_SET);
    if (fileId) {
      const stickerMsg = await ctx.replyWithSticker(fileId);
      await sleep(STICKER_HOLD_MS);
      try { await ctx.telegram.deleteMessage(ctx.chat.id, stickerMsg.message_id); } catch {}
    }
  } catch {}

  let loadingMsg = null;
  try {
    loadingMsg = await ctx.reply(
      `<blockquote>${LOADING_FRAMES[0]}</blockquote>`,
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error('[startCommand] Failed to send loading message:', err.message);
    return;
  }

  for (let i = 1; i < LOADING_FRAMES.length; i++) {
    await sleep(FRAME_DELAY_MS);
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `<blockquote>${LOADING_FRAMES[i]}</blockquote>`,
        { parse_mode: 'HTML' },
      );
    } catch {}
  }

  await sleep(FRAME_DELAY_MS);
  try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch {}
}

const startCommand = async (ctx) => {
  const username = escapeHtml(ctx.from.first_name || 'User');
  const upt      = formatDuration(Math.floor(process.uptime()));
  const mem      = process.memoryUsage();
  const heapMB   = (mem.heapUsed / 1024 / 1024).toFixed(1);

  const arg = (ctx.message?.text || '').split(/\s+/)[1];
  logEvent('start', {
    chat: ctx.chat,
    actor: ctx.from,
    extra: `Username: ${ctx.from.username ? `@${ctx.from.username}` : 'not set'} | Started at: ${new Date().toISOString()}`,
  }).catch(() => {});
  if (arg && arg.startsWith('rules_')) {
    const chatId = parseInt(arg.slice(6), 10);
    if (Number.isInteger(chatId) && isFinite(chatId)) {
      try {
        const g   = await getGroup(chatId);
        const txt = g.rules || 'No rules set for that chat.';
        return ctx.reply(`📜 <b>Rules</b>:\n\n${escapeHtml(txt)}`, { parse_mode: 'HTML' });
      } catch {
        return ctx.reply('⚠️ Failed to fetch rules for that chat.');
      }
    }
  }

  await playStartAnimation(ctx);

  const startMsg =
    `<blockquote>` +
    `╔══════════════════════╗\n` +
    `║  <tg-emoji emoji-id="6172539951985464926">🌸</tg-emoji>  <b>ѕσƒιуα вσт</b>  <tg-emoji emoji-id="6172539951985464926">🌸</tg-emoji>  ║\n` +
    `╚══════════════════════╝\n\n` +
    `<tg-emoji emoji-id="6100469558944994144">😉</tg-emoji> нєу, <b>${username}</b>!\n` +
    `ι αɱ <b>ѕσƒιуα</b> — ყσυя αℓℓ-ιη-σηє\n` +
    `<tg-emoji emoji-id="5305565606030887275">🌸</tg-emoji> Rσsє-Grα∂є Gяσυρ Mαηαɢєя <tg-emoji emoji-id="5305565606030887275">🌸</tg-emoji>\n\n` +
    `╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n` +
    `<tg-emoji emoji-id="6082511510406436819">⚡️</tg-emoji> <b>${ff('Uptime')}</b>  : ${upt}\n` +
    `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> <b>${ff('Memory')}</b>  : ${heapMB} MB\n` +
    `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> <b>${ff('Node')}</b>    : ${process.version}\n` +
    `🖥️ <b>${ff('Host')}</b>    : ${os.hostname()}\n` +
    `╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n` +
    `<tg-emoji emoji-id="6100665125985851649">🔔</tg-emoji> υsє /help тσ sєє αℓℓ cσɱɱαη∂s\n` +
    `<tg-emoji emoji-id="6172539951985464926">🌸</tg-emoji> <b>|ρσωєяє∂ вү вєтα вσт нυв|</b>` +
    `</blockquote>`;

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.url(`➕ ${ff('Add me to Group')}`, `https://t.me/${ctx.botInfo.username}?startgroup=true`),
    ],
    [
      Markup.button.callback(`📜 ${ff('Commands')}`, 'help_main'),
      Markup.button.url(`🌐 ${ff('Website')}`, 'https://beatbot.app/'),
    ],
    [
      Markup.button.url(`👑 ${ff('My Lord')}`, 'https://t.me/SUKOON_S'),
      Markup.button.url(`📢 ${ff('Channel')}`, 'https://t.me/BETABOT_HUB'),
    ],
    [
      Markup.button.callback(`ℹ️ ${ff('About')}`, 'about'),
    ],
  ]);

  // Array of images for random selection
  const startImages = [
    'https://n.uguu.se/HnuyNxVc.jpg',
    'https://n.uguu.se/pPxpzPZQ.jpg',
    'https://h.uguu.se/nkbKLcOi.jpg',
    'https://d.uguu.se/MLrAXCdD.jpg',
    'https://d.uguu.se/GYzBYbQE.jpg',
    'https://n.uguu.se/EFAzlSTC.jpg'
  ];

  // Pick a random image from the array
  const photoUrl = startImages[Math.floor(Math.random() * startImages.length)];

  try {
    await ctx.replyWithPhoto(photoUrl, {
      caption: startMsg,
      parse_mode: 'HTML',
      has_spoiler: true,
      ...kb,
    });
  } catch (err) {
    console.error('[startCommand] Failed to send photo, falling back to text:', err.message);
    try {
      await ctx.reply(startMsg, { parse_mode: 'HTML', ...kb });
    } catch (fallbackErr) {
      console.error('[startCommand] Fallback also failed:', fallbackErr.message);
    }
  }
};

module.exports = startCommand;
