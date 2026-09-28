/**
 * Rule-based NSFW detector — no AI required.
 *
 * Design principles:
 *   • Tier-1 (HARD): single-pattern always-NSFW — very high precision
 *   • Tier-2 (CONTEXTUAL): sexual/violent words are SAFE by themselves;
 *     flagged only when paired with solicitation / sharing / payment signals
 *   • Safe-context override: gaming / educational language prevents false positives
 *   • NSFW emoji clusters count as a signal, never a sole trigger
 *
 * Returns: { nsfw: boolean, reason: string }
 */

'use strict';

// ── Tier-1: always NSFW ───────────────────────────────────────────────────────

const HARD = [

  // Child sexual content
  /\b(csam)\b/i,
  /\b(child|minor|underage|teen)\s*(porn|sex|nude|naked|pic|photo|exploit|abuse)/i,
  /\b(loli(con)?|shota|pedo(phile)?|ephebophil)\b/i,

  // Porn platforms / file sharing of explicit content
  /\b(pornhub|xvideos|xnxx|redtube|xhamster|youporn|brazzers|bangbros|realitykings)\b/i,
  /\bonly\s*fans\.com\/\S+/i,          // onlyfans.com/username (not the brand mention alone)
  /\b(xxx|x-rated)\s*(video|clip|photo|pic|content|site)\b/i,

  // Drug dealing — name + sale/logistics context
  /\b(sell(ing)?|supply(ing)?|deal(ing)?|plug|connect|resell)\s+\w{0,10}\s*(cocaine|coke|smack|heroin|meth|crystal\s*meth|ice|mdma|ecstasy|molly|lsd|acid|mushroom|shroom|ganja|charas|afeem|brown\s*sugar)\b/i,
  /\b(cocaine|heroin|meth|crystal|mdma|ecstasy|ganja|smack|lsd)\s+(for\s+sale|available|order|delivery|stock|dm\s*for|whatsapp)/i,
  /\bwhatsapp\W{0,10}(\+?\d[\d\s\-]{6,})\W{0,20}(weed|ganja|coke|meth|heroin|mdma|cocaine|charas|afeem|lsd|ecstasy|mushroom)/i,
  /\b(weed|ganja|coke|meth|heroin|cocaine|mdma|charas|afeem|lsd|ecstasy)\W{0,20}whatsapp\W{0,10}(\+?\d[\d\s\-]{6,})/i,

  // Sexual solicitation / paid sex / escort
  /\b(sex|blowjob|handjob|bj)\s*(for|in\s*exchange\s*for)\s*(money|cash|pay|gift|food|favour)/i,
  /\b(pay|paid)\s*(for|to\s*get)\s*sex\b/i,
  /\b(escort\s*service|call\s*girl|rent\s*a\s*(girl|boy)|sex\s*worker\s*available|nuru\s*massage|happy\s*ending\s*massage)\b/i,
  /\b(prostitut(e|ion)|solicitat(e|ion))\b/i,
  /\b(nude|nudes?|naked\s*pic|sex\s*tape)\s*(for\s*sale|selling|available|send|dm|free\s*here)\b/i,
  /\bselling\s*(nude|nudes?|explicit|xxx|18\+)\b/i,

  // Doxxing / private data leak
  /\b(home\s*address|personal\s*(phone|mobile|number|address)|private\s*(info|detail))\s*(of|leak|share|post|here|below)\b/i,

  // Scam / fraud
  /\b(earn|make|income|get)\s*\$?\d{2,}[kK]?\s*(per\s*(day|week|hour)|daily|weekly|hourly)\s*(from\s*home|online|easily|fast|without\s*(work|investment))/i,
  /\b(double|triple|10x|5x)\s*your\s*(money|investment|crypto|bitcoin|usdt)\b/i,
  /\binvestment\s*(return|profit|yield)\s*(of\s*)?\d{2,}\s*%/i,
  /\b(guaranteed\s*(profit|return|income)|risk[\s-]free\s*(investment|trade))\b/i,
  /\bwork\s*from\s*home\s*(earn|income|salary|₹|rs\.?\s*\d)\b/i,

  // Self-harm — method-specific (not casual "kill myself")
  /\b(how\s*to|best\s*way\s*to|method\s*(for|of)|step[\s-]by[\s-]step)\s*(commit\s*suicide|hang\s*(myself|yourself)|overdose\s*on|slit\s*(wrists?|throat))\b/i,
  /\b(lethal\s*(dose|method)|painless\s*suicide|suicide\s*(method|guide|tutorial|instruction))\b/i,

  // Gore / snuff
  /\b(snuff\s*(video|film|clip)|torture\s*(porn|vid|clip)|gore\s*(video|clip|site))\b/i,
  /\blive\s*(murder|killing|execution)\s*(video|stream|clip)\b/i,
];

// ── Tier-2 contextual: sexual words alone are SAFE ────────────────────────────

// Sexual body-part / act words that require context to become NSFW
const SEXUAL_WORDS = /\b(fuck(ing)?|sex(ual)?|suck(ing)?|blow\s*job|hand\s*job|cum(\s*shot)?|dick|cock|pussy|boob|tit|ass|anal|fingering|strip(ping)?|nude|naked|masturbat|horny|boner|erect|penetrat)\b/i;

// Solicitation / sharing signals that turn sexual words into NSFW
const SOLICITATION = /\b(want|wanna|looking\s*for|available|hire|tonight|meet(\s*me)?|come\s*over|my\s*place|your\s*place|contact|dm\s*me|inbox\s*me|message\s*me|whatsapp\s*me|send\s*(pic|photo|vid)|share\s*(pic|photo|vid|nude)|get\s*(laid|some))\b/i;
const PAYMENT_SIG  = /\b(rs\.?\s*\d{2,}|₹\s*\d{2,}|\$\s*\d{2,}|paid|payment|rate|price|fee|charge|per\s*hour|per\s*night|negotiable)\b/i;

// ── Safe-context overrides (dramatically reduce false positives) ───────────────

// Gaming context makes "kill", "rape" (gaming slang), "dick" etc. safe
const GAMING = /\b(game|match|gaming|minecraft|pubg|bgmi|fortnite|valorant|cod|freefire|ff|gta|cs[\s:-]?go|dota|lol|pokemon|stream|streamer|youtube|twitch|clip|ez|gg|noob|rekt|pwned|owned|headshot|respawn|lobby|squad|rank|rank[\s-]push|clutch|booyah)\b/i;

// Educational / news context makes drug / violence words safe
const EDUCATIONAL = /\b(study|research|article|news|documentary|awareness|health|medical|treatment|rehab|recovery|hospital|doctor|therapist|statistic|report|journal|wiki|wikipedia)\b/i;

// Angry-rant pattern — "I'll kill you" alone without specific target + method is not NSFW
const CASUAL_THREAT = /\b(i'?ll?\s+kill\s+(you|him|her|them)|gonna\s+kill|imma\s+kill|bc\s+mar|maar\s+dunga)\b/i;

// ── NSFW emoji cluster ─────────────────────────────────────────────────────────
// Alone: just a signal. Combined with SEXUAL_WORDS or SOLICITATION: NSFW.
const NSFW_EMOJI_RE = /[\u{1F346}\u{1F351}\u{1F4A6}\u{1F51E}\u{1F445}\u{1F34C}\u{1F60B}\u{1F975}]/u;
// 🍆🍑💦🔞👅🍌😋🥵

// ── main text check ───────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {{ nsfw: boolean, reason: string }}
 */
function checkText(text) {
  if (!text) return { nsfw: false, reason: 'empty' };

  const t = text.slice(0, 2000);

  // ── Tier-1 hard check ──
  for (const re of HARD) {
    if (re.test(t)) return { nsfw: true, reason: `hard:${re.source.slice(0, 40)}` };
  }

  const hasSexualWord  = SEXUAL_WORDS.test(t);
  const hasSolicitation = SOLICITATION.test(t);
  const hasPayment     = PAYMENT_SIG.test(t);
  const hasNsfwEmoji   = NSFW_EMOJI_RE.test(t);
  const hasGaming      = GAMING.test(t);
  const hasEducational = EDUCATIONAL.test(t);
  const hasCasualThreat = CASUAL_THREAT.test(t);

  // Safe-context short-circuits
  if (hasGaming && !hasPayment) return { nsfw: false, reason: 'gaming-context' };
  if (hasEducational && !hasSolicitation && !hasPayment) return { nsfw: false, reason: 'educational-context' };
  if (hasCasualThreat && !hasSolicitation && !hasPayment) return { nsfw: false, reason: 'casual-threat' };

  // ── Tier-2 contextual ──
  // Sexual word + (solicitation OR payment) = NSFW
  if (hasSexualWord && (hasSolicitation || hasPayment)) {
    return { nsfw: true, reason: 'sexual+solicitation' };
  }

  // NSFW emoji cluster + solicitation = NSFW
  if (hasNsfwEmoji && hasSolicitation) {
    return { nsfw: true, reason: 'nsfw-emoji+solicitation' };
  }

  // NSFW emoji cluster + sexual word = NSFW
  if (hasNsfwEmoji && hasSexualWord) {
    return { nsfw: true, reason: 'nsfw-emoji+sexual-word' };
  }

  return { nsfw: false, reason: 'clean' };
}

// ── image / caption check ─────────────────────────────────────────────────────
//
// Without an ML model we cannot analyse raw pixels. Instead:
//   1. Run the full text check on the caption (most NSFW images have NSFW captions).
//   2. Apply additional hard visual-context signals that appear in captions.
//   3. Return the result — callers should fall back to AI for captionless images.

const VISUAL_HARD = [
  /\b(nude|naked|topless|bottomless|upskirt|downblouse|voyeur|creepshot)\b/i,
  /\b(sex\s*tape|porn\s*(vid|video|clip|link)|xxx\s*(video|photo|pic|clip))\b/i,
  /\b(lingerie|bra\s*less|no\s*panties|exposed|flashing)\s+(pic|photo|vid|here|send|share)/i,
  /\b(gore|blood|dead\s*body|corpse|execution|beheading|torture)\s*(pic|photo|vid|clip|warning|nsfw)\b/i,
];

/**
 * @param {string|null} caption
 * @returns {{ nsfw: boolean, reason: string }}
 */
function checkImageCaption(caption) {
  if (!caption) return { nsfw: false, reason: 'no-caption' };

  const t = caption.slice(0, 2000);
  for (const re of VISUAL_HARD) {
    if (re.test(t)) return { nsfw: true, reason: `visual-hard:${re.source.slice(0, 40)}` };
  }
  return checkText(t);
}

module.exports = { checkText, checkImageCaption };
