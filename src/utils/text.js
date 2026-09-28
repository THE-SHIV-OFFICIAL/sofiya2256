'use strict';

function stripStandardEmoji(value) {
  if (value == null) return value;
  const protectedTags = [];
  const protectedText = String(value).replace(
    /<tg-emoji\b[^>]*>[\s\S]*?<\/tg-emoji>/gi,
    (tag) => {
      const marker = `__SOFIYA_CUSTOM_EMOJI_${protectedTags.length}__`;
      protectedTags.push({ marker, tag });
      return marker;
    }
  );

  let result = protectedText
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  for (const { marker, tag } of protectedTags) {
    result = result.replace(marker, tag);
  }
  return result;
}

module.exports = { stripStandardEmoji };