'use strict';

const nvidiaAI = require('./nvidiaAI');
const logger = require('../utils/logger');

const SYSTEM = `You create one safe, family-friendly Telegram trivia question.
Return JSON only, with exactly these keys:
{"q":"question","a":"short lowercase answer","hint":"optional short hint"}
Rules: answer must be unambiguous, no politics, adult content, insults, or trick
questions. The question must be answerable without a web search. Keep q under
180 characters, a under 40 characters, and hint under 80 characters.`;

function parseJson(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const value = JSON.parse(cleaned);
    if (!value.q || !value.a) return null;
    return {
      q: String(value.q).slice(0, 180),
      a: String(value.a).toLowerCase().trim().slice(0, 40),
      hint: value.hint ? String(value.hint).slice(0, 80) : '',
    };
  } catch {
    return null;
  }
}

async function generateTrivia() {
  if (!nvidiaAI.isConfigured()) return null;
  try {
    const out = await nvidiaAI.chat(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: 'Generate a fresh general-knowledge question.' },
      ],
      {
        model: nvidiaAI.FAST_MODEL,
        temperature: 0.8,
        maxTokens: 180,
        timeoutMs: 8000,
      }
    );
    return parseJson(out);
  } catch (error) {
    logger.warn(`AI trivia generation failed: ${error.message}`);
    return null;
  }
}

module.exports = { generateTrivia };