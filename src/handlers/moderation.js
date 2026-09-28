const { scanText, scanImage, scanCaption } = require('../services/aiModerationService');
const { getGroup } = require('../utils/groupSettings');
const { logNsfw, logEvent } = require('../services/loggingService');
const logger = require('../utils/logger');

const textCache = new Map();
const fileCache = new Map();

const TTL_TEXT = 5 * 60_000;
const TTL_FILE = 30 * 60_000;

const CHAT_SCAN_INTERVAL = 4000;
const chatLastScan = new Map();

const MAX_DOWNLOAD = 5 * 1024 * 1024;

const HARD_NSFW_STICKER_KEYWORDS = [
  'porn',
  'hentai',
  'xxx',
  'nsfw',
  'nude',
  'sex',
  'adult',
  'lewd',
  'ecchi',
  'boobs',
  'milf',
  '18+',
  'fuck',
  'cum',
  'anal',
  'pussy',
  'dick',
  'horny',
  'waifu'
];

function chatOnCooldown(chatId) {
  const last = chatLastScan.get(chatId);
  return last && (Date.now() - last) < CHAT_SCAN_INTERVAL;
}

function stampChat(chatId) {
  chatLastScan.set(chatId, Date.now());

  if (chatLastScan.size > 2000) {
    const cutoff = Date.now() - CHAT_SCAN_INTERVAL * 2;

    for (const [id, ts] of chatLastScan) {
      if (ts < cutoff) {
        chatLastScan.delete(id);
      }
    }
  }
}

function setCache(map, key, value, ttl) {
  map.set(key, value);
  setTimeout(() => map.delete(key), ttl);
}

async function downloadTelegramFile(ctx, fileId) {
  try {
    const link = await ctx.telegram.getFileLink(fileId);

    const res = await fetch(link.href);

    if (!res.ok) return null;

    const len = parseInt(
      res.headers.get('content-length') || '0',
      10
    );

    if (len && len > MAX_DOWNLOAD) return null;

    const buf = Buffer.from(await res.arrayBuffer());

    if (buf.length > MAX_DOWNLOAD) return null;

    return {
      buffer: buf,
      mime: res.headers.get('content-type') || 'image/jpeg'
    };

  } catch (e) {

    logger.warn(`tg download failed: ${e.message}`);

    return null;
  }
}

function pickPhoto(photos) {

  if (!photos || !photos.length) return null;

  for (let i = photos.length - 1; i >= 0; i--) {

    if (
      !photos[i].file_size ||
      photos[i].file_size <= MAX_DOWNLOAD
    ) {
      return photos[i];
    }
  }

  return photos[0];
}

function checkSticker(sticker) {

  if (!sticker) return false;

  const setName = (sticker.set_name || '').toLowerCase();
  const emoji = (sticker.emoji || '').toLowerCase();

  const badPack = HARD_NSFW_STICKER_KEYWORDS.some((kw) =>
    setName.includes(kw)
  );

  const badEmoji =
    emoji.includes('🔞') ||
    emoji.includes('🍑') ||
    emoji.includes('🍆') ||
    emoji.includes('💦') ||
    emoji.includes('👅');

  if (badPack || badEmoji) {

    logger.warn(`NSFW sticker blocked: ${setName}`);

    return true;
  }

  return false;
}

async function checkFileCached(ctx, fileId) {

  const cached = fileCache.get(fileId);

  if (cached !== undefined) {
    return cached;
  }

  const dl = await downloadTelegramFile(ctx, fileId);

  if (!dl) {

    setCache(fileCache, fileId, false, TTL_FILE);

    return false;
  }

  let mime = dl.mime;

  if (!mime || !mime.startsWith('image/')) {
    mime = 'image/jpeg';
  }

  const bad = await scanImage(dl.buffer, mime);

  setCache(fileCache, fileId, bad, TTL_FILE);

  return bad;
}

async function detect(ctx) {

  const m = ctx.message;

  if (!m) {
    return { bad: false, reason: '' };
  }

  const chatId = ctx.chat?.id;

  // TEXT

  const text = m.text || m.caption || '';

  if (text && !text.startsWith('/')) {

    const cacheKey = text
      .slice(0, 200)
      .toLowerCase();

    let bad = textCache.get(cacheKey);

    if (bad === undefined) {

      const onCooldown = chatId
        ? chatOnCooldown(chatId)
        : false;

      if (!onCooldown && chatId) {
        stampChat(chatId);
      }

      bad = await scanText(text);

      setCache(
        textCache,
        cacheKey,
        bad,
        TTL_TEXT
      );
    }

    if (bad) {
      return {
        bad: true,
        reason: 'text'
      };
    }
  }

  // PHOTO

  if (m.photo && m.photo.length) {

    if (
      m.caption &&
      await scanCaption(m.caption)
    ) {
      return {
        bad: true,
        reason: 'image-caption'
      };
    }

    const ph = pickPhoto(m.photo);

    if (ph) {

      const isBad = await checkFileCached(
        ctx,
        ph.file_id
      );

      if (isBad) {

        logger.warn('NSFW IMAGE DETECTED');

        return {
          bad: true,
          reason: 'image'
        };
      }
    }
  }

  // STICKER

  if (m.sticker) {

    if (checkSticker(m.sticker)) {

      return {
        bad: true,
        reason: 'sticker'
      };
    }
  }

  // GIF / VIDEO / DOC

  for (const mediaKey of [
    'animation',
    'video',
    'video_note',
    'document'
  ]) {

    const obj = m[mediaKey];

    if (!obj) continue;

    const thumb = obj.thumbnail || obj.thumb;

    if (
      thumb &&
      await checkFileCached(ctx, thumb.file_id)
    ) {
      return {
        bad: true,
        reason: mediaKey
      };
    }

    if (
      mediaKey === 'document' &&
      obj.mime_type?.startsWith('image/') &&
      (obj.file_size || 0) <= MAX_DOWNLOAD
    ) {

      if (
        await checkFileCached(
          ctx,
          obj.file_id
        )
      ) {
        return {
          bad: true,
          reason: 'document-image'
        };
      }
    }
  }

  return {
    bad: false,
    reason: ''
  };
}

async function aiModeration(ctx, next) {

  if (
    !ctx.message ||
    !ctx.chat ||
    ctx.chat.type === 'private'
  ) {
    return next();
  }

  if (ctx.from?.is_bot) {
    return next();
  }

  if (ctx.from?.id === ctx.botInfo?.id) {
    return next();
  }

  let group;

  try {

    group = await getGroup(ctx.chat.id);

  } catch {

    return next();
  }

  if (group.nsfwProtection === false) {
    return next();
  }

  let result;

  try {

    result = await detect(ctx);

  } catch (e) {

    logger.warn(
      `moderation detect error: ${e.message}`
    );

    return next();
  }

  if (!result.bad) {
    return next();
  }

  const userTag = ctx.from.first_name
    ? `<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`
    : 'User';

  try {

    await ctx.deleteMessage();

  } catch {}

  try {

    await ctx.reply(
      `🚫 <b>NSFW Content Removed</b>\n\n` +
      `👤 User: ${userTag}\n` +
      `📌 Type: <b>${result.reason}</b>\n\n` +
      `<i>Protection enabled.</i>`,
      {
        parse_mode: 'HTML'
      }
    );

  } catch {}

  // Strict mode is an optional second action. Admins and the owner are never
  // muted by this automatic rule, but their content is still removed/logged.
  if (group.strictMode && !ctx.isAdmin && !ctx.isOwner) {
    try {
      await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.from.id, {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        },
        until_date: Math.floor(Date.now() / 1000) + 60 * 60,
      });
      logEvent('mute', {
        chat: ctx.chat,
        actor: ctx.from,
        target: ctx.from,
        reason: 'Strict NSFW protection',
        duration: '1h',
      }).catch(() => {});
    } catch (e) {
      logger.warn(`strict NSFW mute failed: ${e.message}`);
    }
  }

  logNsfw(ctx, result.reason)
    .catch(() => {});

  return;
}

module.exports = aiModeration;
