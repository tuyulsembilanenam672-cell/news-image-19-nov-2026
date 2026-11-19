// The World in One Day - 19 November 2026.
// A deterministic newspaper front page, drawn pixel by pixel with Node's
// standard library only. No network, no fonts, no dependencies: the program
// builds a 1024x1024 RGB image in memory, encodes it as a PNG with zlib,
// and writes it to /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// Running it twice produces byte-identical output.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// PNG encoding (CRC32 + zlib deflate, all deterministic)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase A-Z, digits, punctuation). Each glyph is 7 rows
// of 5 bits, most significant bit on the left.
// ---------------------------------------------------------------------------

const FONT = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '+': [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '*': [0, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
};

const CHAR_W = 6; // glyph advance in font units (5 px + 1 px gap)
const CHAR_H = 7;

function textWidth(text, scale) {
  return text.length * CHAR_W * scale - scale; // no trailing gap
}

// ---------------------------------------------------------------------------
// Canvas: a fixed 1024x1024 RGB buffer with simple drawing primitives
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const PAPER = [246, 241, 229];
const INK = [20, 18, 16];
const RED = [163, 29, 33];
const BLUE = [29, 78, 137];
const GOLD = [178, 138, 44];
const TEAL = [18, 110, 105];
const GREY = [110, 104, 92];
const LIGHT = [232, 224, 205];

class Canvas {
  constructor() {
    this.buf = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = PAPER[0];
      this.buf[i * 3 + 1] = PAPER[1];
      this.buf[i * 3 + 2] = PAPER[2];
    }
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fillRect(x, y, w, h, c) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }
  rect(x, y, w, h, c, t = 1) {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }
  hline(x, y, len, c, t = 1) { this.fillRect(x, y, len, t, c); }
  vline(x, y, len, c, t = 1) { this.fillRect(x, y, t, len, c); }
  line(x0, y0, x1, y1, c, t = 1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      this.fillRect(x - ((t / 2) | 0), y - ((t / 2) | 0), t, t, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.set(cx + x, cy + y, c);
    }
  }
  ring(cx, cy, r, c, t = 2) {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.set(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
      }
    }
  }
  triangle(x0, y0, x1, y1, x2, y2, c) {
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
        const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
        const g = 1 - a - b;
        if (a >= 0 && b >= 0 && g >= 0) this.set(x, y, c);
      }
    }
  }
  // Text: draws one glyph, then a whole string (left-aligned).
  glyph(ch, x, y, scale, c) {
    const rows = FONT[ch];
    if (!rows) return;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (rows[r] & (0x10 >> col)) {
          this.fillRect(x + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
  text(str, x, y, scale, c) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      this.glyph(ch, cx, y, scale, c);
      cx += CHAR_W * scale;
    }
    return cx;
  }
  textCentered(str, cx, y, scale, c) {
    this.text(str, cx - Math.floor(textWidth(str, scale) / 2), y, scale, c);
  }
}

// Word-wrap: greedy, returns lines that fit maxWidth at the given scale.
function wrap(text, maxWidth, scale) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPara(cv, text, x, y, maxWidth, scale, color, lineH) {
  const lines = wrap(text, maxWidth, scale);
  lines.forEach((ln, i) => cv.text(ln, x, y + i * lineH, scale, color));
  return lines.length;
}

// ---------------------------------------------------------------------------
// Small pictograms, one per story (drawn from rectangles, lines and discs)
// ---------------------------------------------------------------------------

function iconIran(cv, x, y) {
  const cx = x + 39, cy = y + 39;
  for (let a = 0; a < 8; a++) {
    const r = (a * Math.PI) / 4;
    cv.line(cx, cy, Math.round(cx + 34 * Math.cos(r)), Math.round(cy + 34 * Math.sin(r)), RED, 3);
  }
  cv.disc(cx, cy, 12, GOLD);
  cv.disc(cx, cy, 6, RED);
}

function iconApec(cv, x, y) {
  cv.disc(x + 24, y + 30, 16, RED);
  cv.disc(x + 54, y + 30, 16, BLUE);
  cv.disc(x + 39, y + 52, 16, GOLD);
  cv.hline(x + 8, y + 70, 62, INK, 3);
}

function iconEu(cv, x, y) {
  for (let a = 0; a < 12; a++) {
    const r = (a * Math.PI) / 6;
    cv.disc(Math.round(x + 39 + 26 * Math.cos(r)), Math.round(y + 34 + 26 * Math.sin(r)), 4, GOLD);
  }
  cv.disc(x + 39, y + 34, 10, BLUE);
  cv.fillRect(x + 14, y + 62, 50, 10, BLUE);
  cv.fillRect(x + 18, y + 65, 42, 4, PAPER);
}

function iconCyclone(cv, x, y) {
  const cx = x + 39, cy = y + 39;
  cv.ring(cx, cy, 30, TEAL, 4);
  cv.ring(cx - 6, cy + 4, 20, TEAL, 4);
  cv.ring(cx - 10, cy + 8, 11, TEAL, 4);
  cv.disc(cx - 12, cy + 10, 4, RED);
}

function iconVoyager(cv, x, y) {
  cv.disc(x + 12, y + 12, 3, GOLD);
  cv.disc(x + 62, y + 10, 2, RED);
  cv.disc(x + 68, y + 58, 3, GOLD);
  cv.line(x + 10, y + 62, x + 32, y + 36, BLUE, 4);
  cv.line(x + 32, y + 36, x + 64, y + 22, BLUE, 4);
  cv.triangle(x + 28, y + 26, x + 66, y + 12, x + 60, y + 34, GOLD);
  cv.disc(x + 46, y + 24, 4, RED);
}

function iconJeffries(cv, x, y) {
  cv.fillRect(x + 12, y + 60, 54, 6, INK);
  cv.fillRect(x + 16, y + 40, 6, 20, INK);
  cv.fillRect(x + 36, y + 40, 6, 20, INK);
  cv.fillRect(x + 56, y + 40, 6, 20, INK);
  cv.fillRect(x + 22, y + 34, 34, 6, BLUE);
  cv.disc(x + 39, y + 34, 13, BLUE);
  cv.vline(x + 39, y + 8, 14, INK, 2);
  cv.fillRect(x + 39, y + 8, 14, 8, RED);
}

// Lead illustration: a Vice City skyline at sunset with a palm tree.
function leadArt(cv, x, y, w, h) {
  cv.fillRect(x, y, w, h, LIGHT);
  cv.disc(x + w - 52, y + 30, 22, GOLD);
  cv.ring(x + w - 52, y + 30, 28, GOLD, 2);
  const base = y + h;
  const towers = [0.42, 0.62, 0.34, 0.78, 0.55, 0.88, 0.48, 0.66];
  const tw = Math.floor(w / towers.length);
  towers.forEach((f, i) => {
    const th = Math.floor(h * f);
    cv.fillRect(x + i * tw + 2, base - th, tw - 4, th, INK);
    cv.fillRect(x + i * tw + 6, base - th + 6, 4, 4, GOLD);
    cv.fillRect(x + i * tw + 6, base - th + 16, 4, 4, GOLD);
  });
  cv.fillRect(x, base - 6, w, 6, RED);
  // Palm tree in the foreground corner.
  const px = x + 26, py = base - 6;
  cv.line(px, py, px + 10, py - 52, INK, 4);
  for (let a = 0; a < 5; a++) {
    const ang = Math.PI * (0.15 + a * 0.18);
    cv.line(px + 10, py - 52, Math.round(px + 10 + 26 * Math.cos(ang)), Math.round(py - 52 - 18 * Math.sin(ang)), TEAL, 3);
  }
}

// ---------------------------------------------------------------------------
// The front page
// ---------------------------------------------------------------------------

const STORIES = [
  {
    tag: 'MIDDLE EAST',
    head: 'US AND IRAN TRADE FIRE AGAIN',
    body: 'TEHRAN HITS A US BASE IN KUWAIT AND BAHRAIN AFTER US STRIKES ON QESHM ISLAND.',
    icon: iconIran,
  },
  {
    tag: 'DIPLOMACY',
    head: 'LEADERS MEET IN SHENZHEN',
    body: 'TRUMP, XI AND PUTIN HOLD TRILATERAL TALKS AT THE APEC SUMMIT IN SHENZHEN, CHINA.',
    icon: iconApec,
  },
  {
    tag: 'EUROPE',
    head: 'EU PLANS EUR 45BN UKRAINE LOAN',
    body: 'BRUSSELS PLANS A LOAN TO FUND KYIV, REPAID ONCE RUSSIA PAYS REPARATIONS.',
    icon: iconEu,
  },
  {
    tag: 'WEATHER',
    head: 'CYCLONE AKVAN NEARS INDIA',
    body: 'THE STORM IS SET TO CROSS THE COAST BETWEEN MACHILIPATNAM AND PURI.',
    icon: iconCyclone,
  },
  {
    tag: 'SPACE',
    head: 'VOYAGER 1 REACHES ONE LIGHT-DAY',
    body: 'NASA BELIEVES ITS PROBE HAS REACHED ONE LIGHT-DAY FROM EARTH AFTER NEARLY 50 YEARS.',
    icon: iconVoyager,
  },
  {
    tag: 'WASHINGTON',
    head: 'JEFFRIES NOMINATED FOR SPEAKER',
    body: 'DEMOCRATS NOMINATE HAKEEM JEFFRIES, WHO WOULD BE THE FIRST BLACK HOUSE SPEAKER.',
    icon: iconJeffries,
  },
];

function drawCard(cv, s, x, y, w, h) {
  cv.rect(x, y, w, h, INK, 2);
  cv.text(s.tag, x + 14, y + 12, 2, RED);
  cv.hline(x + 14, y + 32, w - 28, GREY, 1);
  drawPara(cv, s.head, x + 14, y + 42, w - 28 - 92, 3, INK, 24);
  drawPara(cv, s.body, x + 14, y + 98, w - 28 - 92, 2, INK, 18);
  s.icon(cv, x + w - 92, y + 44);
}

function buildPage() {
  const cv = new Canvas();
  const MX = 40; // margin
  const CW = W - 2 * MX; // 944

  // Masthead.
  cv.textCentered('THE WORLD IN ONE DAY', W / 2, 44, 6, INK);
  cv.hline(MX, 100, CW, INK, 3);
  cv.hline(MX, 106, CW, INK, 1);
  cv.textCentered('THURSDAY 19 NOVEMBER 2026', W / 2, 120, 3, RED);
  cv.textCentered('SEVEN STORIES FROM ONE DAY IN WORLD NEWS', W / 2, 148, 2, GREY);

  // Lead story.
  const LY = 176, LH = 240;
  cv.rect(MX, LY, CW, LH, INK, 3);
  cv.text('LEAD STORY - CULTURE', MX + 16, LY + 14, 2, RED);
  cv.text('GAMERS ENTER VICE CITY', MX + 16, LY + 38, 4, INK);
  cv.text('GTA VI BEGINS GLOBAL ROLLOUT', MX + 16, LY + 74, 4, INK);
  leadArt(cv, MX + 16, LY + 116, 304, 108);
  drawPara(
    cv,
    'AFTER A 13-YEAR WAIT, GRAND THEFT AUTO VI BEGINS ITS GLOBAL ROLLOUT, WITH PLAYERS QUEUING AROUND THE WORLD.',
    MX + 344, LY + 116, CW - 344 - 16, 2, INK, 19,
  );
  cv.text('AFTER 13 YEARS, VICE CITY OPENS.', MX + 344, LY + 196, 2, GREY);

  // Six story cards: 2 columns x 3 rows.
  const cardW = Math.floor((CW - 16) / 2); // 464
  const cardH = 172;
  STORIES.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    drawCard(cv, s, MX + col * (cardW + 16), 432 + row * (cardH + 14), cardW, cardH);
  });

  // Footer.
  cv.hline(MX, 980, CW, INK, 2);
  cv.textCentered('ALL STORIES REPORTED ON THURSDAY 19 NOVEMBER 2026', W / 2, 994, 2, GREY);
  return cv;
}

function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePng(W, H, buildPage().buf);
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
