'use strict';

/**
 * NVIDIA AI (NIM / build.nvidia.com) client — plain fetch, OpenAI compatible.
 *
 * Features:
 *  - Multi-key rotation (NVIDIA_API_KEY, NVIDIA_API_KEY_2, NVIDIA_API_KEY_3)
 *  - Per-key cooldown on 429 / 401 so a dead key is skipped automatically
 *  - Hard wall-clock timeout so Telegraf updates never hang
 *  - Automatic failover to the next key on rate-limit / auth / 5xx errors
 */

const config = require('../config/index');
const logger = require('../utils/logger');

const ENDPOINT =
  process.env.NVIDIA_BASE_URL?.replace(/\/+$/, '')
    ? `${process.env.NVIDIA_BASE_URL.replace(/\/+$/, '')}/chat/completions`
    : 'https://integrate.api.nvidia.com/v1/chat/completions';

// Models hosted on NVIDIA NIM
const CHAT_MODEL = process.env.NVIDIA_CHAT_MODEL || 'nvidia/nemotron-3-super-120b-a12b';
const FAST_MODEL = process.env.NVIDIA_FAST_MODEL || 'nvidia/nemotron-3-nano-30b-a3b';

const DEFAULT_TIMEOUT = 15_000;
const KEY_COOLDOWN_MS = 60_000;

const keyState = new Map(); // key -> blockedUntil (epoch ms)

function allKeys() {
  return (config.nvidiaApiKeys || []).filter(Boolean);
}

function usableKeys() {
  const now = Date.now();
  const keys = allKeys();
  const free = keys.filter((k) => (keyState.get(k) || 0) <= now);
  return free.length ? free : keys; // if all cooling down, still try
}

function blockKey(key, ms = KEY_COOLDOWN_MS) {
  keyState.set(key, Date.now() + ms);
}

function isConfigured() {
  return allKeys().length > 0;
}

async function rawCall(key, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300);
      const err = new Error(`NVIDIA ${res.status}: ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message || {};
    // Some NIM reasoning models return the answer in `content`, and their
    // scratchpad in `reasoning_content` — only the answer is used.
    return String(message.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask NVIDIA AI for a completion. Returns the text, or null when every
 * attempt fails.
 */
async function chat(messages, options = {}) {
  if (!isConfigured()) {
    logger.warn('NVIDIA AI: no API key configured (set NVIDIA_API_KEY).');
    return null;
  }

  const body = {
    model: options.model || CHAT_MODEL,
    messages,
    temperature: options.temperature ?? 0.75,
    // Nemotron 3 is a reasoning model — keep headroom so the visible
    // reply is never cut off by the hidden reasoning tokens.
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 0.95,
    stream: false,
  };
  if (options.frequencyPenalty != null) body.frequency_penalty = options.frequencyPenalty;
  if (options.presencePenalty != null) body.presence_penalty = options.presencePenalty;

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
  const keys = usableKeys();

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const text = await rawCall(key, body, timeoutMs);
      if (text) return text;
      logger.warn('NVIDIA AI returned an empty reply.');
    } catch (e) {
      const status = e.status;
      if (status === 429) blockKey(key, 30_000);
      else if (status === 401 || status === 403) blockKey(key, 10 * 60_000);
      logger.warn(
        `NVIDIA AI call failed (${status || 'network'}): ${String(e.message).slice(0, 160)}`
      );
    }
  }
  return null;
}

module.exports = { chat, isConfigured, CHAT_MODEL, FAST_MODEL, ENDPOINT };
