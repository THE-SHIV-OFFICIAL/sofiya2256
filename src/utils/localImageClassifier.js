'use strict';

/**
 * Local NSFW image classifier using nsfwjs + @tensorflow/tfjs.
 * No API key required — runs fully offline after the model is downloaded once.
 *
 * nsfwjs categories:
 *   Porn     — explicit sexual content
 *   Hentai   — explicit anime/drawn sexual content
 *   Sexy     — suggestive but not fully explicit
 *   Neutral  — safe everyday content
 *   Drawing  — safe art/illustrations
 *
 * Returns true (NSFW) when Porn or Hentai probability >= PORN_THRESHOLD,
 * or when Sexy probability >= SEXY_THRESHOLD.
 */

const logger = require('./logger');

const PORN_THRESHOLD  = 0.60; // flag if Porn or Hentai >= 60%
const SEXY_THRESHOLD  = 0.80; // flag if Sexy alone >= 80%
const MODEL_LOAD_TIMEOUT = 30_000;
const CLASSIFY_TIMEOUT   = 10_000;

let _model  = null;
let _loading = null; // Promise while model is loading

async function _loadModel() {
  if (_model)   return _model;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      // Import lazily — only loaded once
      const nsfwjs = require('nsfwjs');
      require('@tensorflow/tfjs'); // ensure backend is registered

      logger.info('nsfwjs: loading NSFW model…');
      const m = await Promise.race([
        nsfwjs.load(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('model load timeout')), MODEL_LOAD_TIMEOUT)),
      ]);
      _model = m;
      logger.info('nsfwjs: model ready ✅');
      return _model;
    } catch (e) {
      logger.warn(`nsfwjs: model load failed — ${e.message}`);
      _loading = null;
      throw e;
    }
  })();
  return _loading;
}

// Pre-load on first import (non-blocking — failures are silently caught)
_loadModel().catch(() => {});

/**
 * Classify a raw image buffer.
 * @param {Buffer} buffer  Raw image bytes (jpeg / png / webp / gif)
 * @param {string} [mime]
 * @returns {Promise<boolean>} true = NSFW, false = safe
 */
async function classifyImage(buffer) {
  if (!buffer || buffer.length < 100) return false;

  let model;
  try {
    model = await Promise.race([
      _loadModel(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('model not ready')), CLASSIFY_TIMEOUT)),
    ]);
  } catch {
    return false; // model unavailable — fail open
  }

  try {
    const sharp = require('sharp');
    const tf    = require('@tensorflow/tfjs');

    // Decode + resize to 299×299 RGB (InceptionV3 input size)
    const { data } = await sharp(buffer)
      .resize(299, 299, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [299, 299, 3]);

    let predictions;
    try {
      predictions = await Promise.race([
        model.classify(tensor),
        new Promise((_, rej) => setTimeout(() => rej(new Error('classify timeout')), CLASSIFY_TIMEOUT)),
      ]);
    } finally {
      tensor.dispose();
    }

    // predictions = [{ className, probability }, ...]
    const prob = {};
    for (const p of predictions) prob[p.className] = p.probability;

    const isPorn   = (prob.Porn   || 0) >= PORN_THRESHOLD;
    const isHentai = (prob.Hentai || 0) >= PORN_THRESHOLD;
    const isSexy   = (prob.Sexy   || 0) >= SEXY_THRESHOLD;

    if (isPorn || isHentai || isSexy) {
      logger.warn(`nsfwjs: NSFW image detected — Porn:${(prob.Porn||0).toFixed(2)} Hentai:${(prob.Hentai||0).toFixed(2)} Sexy:${(prob.Sexy||0).toFixed(2)}`);
      return true;
    }
    return false;
  } catch (e) {
    logger.warn(`nsfwjs classify error: ${e.message?.slice(0, 100)}`);
    return false;
  }
}

module.exports = { classifyImage };
