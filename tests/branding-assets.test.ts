import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

test("PWA branding icons have the declared sizes and purposes", async () => {
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8")) as {
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };
  for (const purpose of ["any", "maskable"]) {
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((entry) => entry.purpose === purpose && entry.sizes === `${size}x${size}`);
      assert.ok(icon, `Missing ${purpose} ${size}px icon`);
      assert.equal(icon.type, "image/png");
      assert.match(icon.src, /^\/ocatms-brand-(?:maskable-)?(?:192|512)\.png$/);
      const metadata = await sharp(`public${icon.src}`).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, size);
      assert.equal(metadata.height, size);
    }
  }
});

test("maskable icons keep the logo within the safe circle", async () => {
  for (const size of [192, 512]) {
    const { data, info } = await sharp(`public/ocatms-brand-maskable-${size}.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x + 0.5 - center, y + 0.5 - center) <= size * 0.4) continue;
        const offset = (y * size + x) * info.channels;
        assert.ok(
          data[offset] === 244 && data[offset + 1] === 244 &&
          data[offset + 2] === 246 && data[offset + 3] === 255,
          `Unexpected artwork outside safe zone at ${x},${y} in ${size}px icon`,
        );
      }
    }
  }
});

test("page logo remains a transparent PNG", async () => {
  const { data, info } = await sharp("public/ocatms-brand.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 200);
  assert.equal(info.height, 196);
  assert.equal(data[3], 0);
});
