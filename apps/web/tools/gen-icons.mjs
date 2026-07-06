// Generate the PWA raster icons (no image deps) so Chromium treats the app as
// installable. Draws a simple diamond mark; regenerate with:
//   node tools/gen-icons.mjs
import { crc32, deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawDiamond(size, padFraction) {
  const bg = [11, 15, 20, 255]; // #0b0f14
  const fg = [240, 101, 58, 255]; // #f0653a
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const r = (size / 2) * (1 - padFraction);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = Math.abs(x - c) + Math.abs(y - c) <= r;
      const [rr, gg, bb, aa] = inside ? fg : bg;
      const o = (y * size + x) * 4;
      rgba[o] = rr;
      rgba[o + 1] = gg;
      rgba[o + 2] = bb;
      rgba[o + 3] = aa;
    }
  }
  return encodePng(size, rgba);
}

writeFileSync(join(OUT, 'icon-192.png'), drawDiamond(192, 0.14));
writeFileSync(join(OUT, 'icon-512.png'), drawDiamond(512, 0.14));
writeFileSync(join(OUT, 'icon-maskable-512.png'), drawDiamond(512, 0.3)); // maskable safe zone
console.log('[web] wrote PWA icons to', OUT);
