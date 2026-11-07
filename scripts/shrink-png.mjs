// Re-compresses PNG files in place at maximum zlib level (macOS `sips` writes them
// poorly compressed — flat-color splash images shrink to about a third).
// Usage: node scripts/shrink-png.mjs <file.png> [...]
import fs from "node:fs";
import zlib from "node:zlib";

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function shrink(buf) {
  const out = [buf.subarray(0, 8)]; // PNG signature
  const idat = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      const raw = zlib.inflateSync(Buffer.concat(idat));
      out.push(chunk("IDAT", zlib.deflateSync(raw, { level: 9 })));
      out.push(chunk("IEND", Buffer.alloc(0)));
    } else {
      out.push(buf.subarray(pos, pos + 12 + len)); // IHDR etc. copied as-is
    }
    pos += 12 + len;
  }
  return Buffer.concat(out);
}

for (const file of process.argv.slice(2)) {
  const before = fs.readFileSync(file);
  const after = shrink(before);
  if (after.length < before.length) fs.writeFileSync(file, after);
}
