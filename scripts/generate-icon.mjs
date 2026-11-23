import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

mkdirSync("apps/desktop/src-tauri/icons", { recursive: true });
const w = 512;
const h = 512;
const raw = Buffer.alloc((w * 4 + 1) * h);

for (let y = 0; y < h; y++) {
  const row = y * (w * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < w; x++) {
    const i = row + 1 + x * 4;
    const inBook = x > 110 && x < 402 && y > 86 && y < 426;
    const isSpine = x > 110 && x < 160 && y > 86 && y < 426;
    const isAccentLine =
      x > 190 &&
      x < 360 &&
      ((y > 160 && y < 186) || (y > 220 && y < 246) || (y > 280 && y < 306));
    if (isSpine || isAccentLine) {
      raw[i] = 29;
      raw[i + 1] = 78;
      raw[i + 2] = 216;
      raw[i + 3] = 255;
    } else if (inBook) {
      raw[i] = 250;
      raw[i + 1] = 248;
      raw[i + 2] = 243;
      raw[i + 3] = 255;
    } else {
      raw[i] = 28;
      raw[i + 1] = 27;
      raw[i + 2] = 25;
      raw[i + 3] = 255;
    }
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("apps/desktop/src-tauri/icons/icon.png", png);
console.log("Generated apps/desktop/src-tauri/icons/icon.png:", png.length, "bytes");
