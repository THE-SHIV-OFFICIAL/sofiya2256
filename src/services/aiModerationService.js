'use strict';

/**
 * NSFW / harmful-content moderation — NVIDIA AI powered.
 *
 * TEXT:
 *   1. Rule engine (instant, zero network)
 *   2. NVIDIA AI classification (fast model, strict one-word answer)
 *   3. AI unavailable -> rule result is final
 *
 * IMAGE:
 *   1. Caption rules + NVIDIA AI text scan of the caption
 *   2. Local nsfwjs ML classifier (on-device, no network)
 *   3. Optional OCR text (if tesseract is available) re-scanned by the AI
 *   4. Everything unavailable -> fail open (never block a clean chat)
 */

const nvidiaAI = require('./nvidiaAI');
const logger  = require('../utils/logger');
const { checkText, checkImageCaption } = require('../utils/nsfwRules');
const { classifyImage } = require('../utils/localImageClassifier');

const AI_TIMEOUT = 6_000;

const TEXT_SYSTEM = `You are a strict content moderator for a Telegram group. Answer with exactly ONE word and nothing else: NSFW or SAFE.

Answer "NSFW" ONLY if the message contains:
- Explicit sexual / pornographic content, sexual solicitation, graphic sexual description
- Sexualization of minors in any form (real, cartoon or AI)
- Drug selling / promotion / dealing
- Extreme gore, torture, snuff
- Real threats of violence or murder against a person or group
- Scam, phishing, fake investment or "easy money" spam links
- Self-harm or suicide methods / instructions
- Doxxing — sharing someone's private personal data without consent
- Links to porn / escort / adult sites

Answer "SAFE" for everything else, including:
- Casual slang, swearing, profanity, roasting between users
- Memes, jokes, dark humour, trash-talk
- Normal flirting or mild innuendo that is not graphic
- Gaming violence talk ("I'll kill you in this match")
- Angry rants, arguments
- Drugs discussed in a news or educational context

Answer with ONE word: NSFW or SAFE.`;

const OCR_SYSTEM = `You moderate text extracted from an image posted in a Telegram group. Answer exactly ONE word: NSFW or SAFE. Mark NSFW only for pornographic invitations, adult-site links, escort ads, drug sales, scam/phishing offers, or sexualization of minors. Ordinary text, memes and swearing are SAFE.`;

// ── AI layers ─────────────────────────────────────────────────────────────────

async function aiClassify(system, content) {
  if (!nvidiaAI.isConfigured()) return null;
  if (!content) return null;

  const out = await nvidiaAI.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: String(content).slice(0, 1500) },
    ],
    {
      model: nvidiaAI.FAST_MODEL,
      temperature: 0,
      maxTokens: 200,
      reasoningEffort: 'low',
      timeoutMs: AI_TIMEOUT,
    }
  );

  if (!out) return null;
  const verdict = out.toUpperCase();
  if (verdict.includes('NSFW')) return true;
  if (verdict.includes('SAFE')) return false;
  return null;
}

async function ocrText(buffer) {
  try {
    const { recognize } = require('tesseract.js');
    const res = await Promise.race([
      recognize(buffer, 'eng'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ocr timeout')), 8_000)),
    ]);
    const text = (res?.data?.text || '').trim();
    return text.length > 6 ? text : null;
  } catch {
    return null; // OCR is optional
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/** Scan text. Returns true (NSFW) / false (safe). Never throws. */
async function scanText(text) {
  if (!text) return false;

  try {
    const { nsfw: ruleHit, reason } = checkText(text);
    if (ruleHit) {
      logger.warn(`NSFW [rules] ${reason}`);
      return true;
    }
  } catch (e) {
    logger.warn(`nsfw rule engine error: ${e.message}`);
  }

  const ai = await aiClassify(TEXT_SYSTEM, text);
  if (ai === true) {
    logger.warn('NSFW [nvidia-text]');
    return true;
  }
  return false;
}

/** Scan an image buffer. Returns true (NSFW) / false (safe). Never throws. */
async function scanImage(imageBuffer /*, mime */) {
  if (!imageBuffer) return false;

  // Layer 1: local ML classifier (fast, no network, works for pure images)
  try {
    if (await classifyImage(imageBuffer)) {
      logger.warn('NSFW [local-classifier]');
      return true;
    }
  } catch (e) {
    logger.warn(`local classifier error: ${e.message}`);
  }

  // Layer 2: AI reads any text baked into the image (porn links, escort ads…)
  const text = await ocrText(imageBuffer);
  if (text) {
    const ai = await aiClassify(OCR_SYSTEM, text);
    if (ai === true) {
      logger.warn('NSFW [nvidia-ocr]');
      return true;
    }
  }

  return false;
}

/** Scan an image / video caption. Returns true (NSFW) / false (safe). */
async function scanCaption(caption) {
  if (!caption) return false;
  try {
    const { nsfw, reason } = checkImageCaption(caption);
    if (nsfw) {
      logger.warn(`NSFW [caption-rules] ${reason}`);
      return true;
    }
  } catch (e) {
    logger.warn(`caption rule error: ${e.message}`);
  }
  return scanText(caption);
}

const scanContent = scanText;

module.exports = { scanText, scanImage, scanCaption, scanContent };
