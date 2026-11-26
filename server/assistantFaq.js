// "Ask Fazal" FAQ engine: ~500 ready answers matched by keywords (any spelling variant listed in each entry).
import { CORE } from './assistantFaqCore.js';
import { HARDWARE } from './assistantFaqHardware.js';
import { PAINT_FAQ } from './assistantFaqPaint.js';
import { MORE } from './assistantFaqMore.js';
import { MATRIX2 } from './assistantFaqMatrix.js';

export const FAQ = [...CORE, ...HARDWARE, ...PAINT_FAQ, ...MORE, ...MATRIX2];
export const FAQ_STATS = { answers: FAQ.length, keywords: FAQ.reduce((n, e) => n + e.k.length + (e.and ? e.and.length : 0), 0) };

// Small chit-chat entries only apply to short messages so they never hijack real questions.
const MAX_WORDS = { okay: 3, nice_site: 7, love: 7, goodnight: 5, joke: 5, abuse: 9, jumma: 6, eid_wish: 8, weather: 8, prayer_time: 8, human: 12, capabilities: 7, whoami: 9 };

function one(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1; if (edits > 1) return false;
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function groupScore(phrases, padded, tokens) {
  let score = 0;
  let hit = 0;
  for (const phrase of phrases) {
    if (padded.includes(` ${phrase} `)) {
      score += phrase.includes(' ') ? 2 : 1;
      hit += phrase.length;
    } else if (!phrase.includes(' ') && phrase.length >= 6 && tokens.some((t) => t.length >= 6 && one(t, phrase))) {
      score += 0.8;
      hit += phrase.length * 0.8;
    }
  }
  return { score, hit };
}

export function matchFaq(clean) {
  const padded = ` ${clean} `;
  const tokens = clean.split(' ').filter(Boolean);
  let best = null;
  for (const entry of FAQ) {
    if (MAX_WORDS[entry.id] && tokens.length > MAX_WORDS[entry.id]) continue;
    if (entry.x && entry.x.some((p) => padded.includes(` ${p} `))) continue;
    const main = groupScore(entry.k, padded, tokens);
    if (main.score <= 0) continue;
    let total = main.score;
    let hit = main.hit;
    if (entry.and) {
      const extra = groupScore(entry.and, padded, tokens);
      if (extra.score <= 0) continue;
      total += extra.score + 2; // a combined match (e.g. colour + room) is more specific
      hit += extra.hit;
    }
    if (!best || total > best.score || (total === best.score && hit > best.hit)) best = { entry, score: total, hit };
  }
  return best;
}

export function renderFaq(entry, english, ctx, priceAsked = false) {
  let text = english && entry.en ? entry.en : entry.ur;
  if (entry.note) {
    text += english
      ? (priceAsked
        ? `\n\nI checked the website catalogue and could not find this item with a price. Please visit the shop or WhatsApp ${ctx.WA} for stock and price. 🙂`
        : `\n\nFor stock/price I check the website catalogue first - type the item name here. If it is not listed, please visit the shop or WhatsApp ${ctx.WA}. 🙂`)
      : (priceAsked
        ? `\n\nMaine website ke catalog mein dekha, ye item rate ke sath mujhe nahi mila. Rate aur stock ke liye dukan visit karein ya WhatsApp karein: ${ctx.WA}. 🙂`
        : `\n\nRate/stock ke liye main pehle website ka catalog dekhta hoon - item ka naam yahan likh dein. Catalog mein na ho to dukan visit karein ya WhatsApp karein: ${ctx.WA}. 🙂`);
  }
  return text
    .replace(/\{WA\}/g, ctx.WA).replace(/\{EMAIL\}/g, ctx.EMAIL)
    .replace(/\{HRSEN\}/g, ctx.HRSEN).replace(/\{HRS\}/g, ctx.HRS)
    .replace(/\{BR\}/g, ctx.BR);
}
