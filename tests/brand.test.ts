import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const tokens = JSON.parse(readFileSync("docs/branding/tokens.json", "utf8"));
function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels.reduce(
    (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
    0,
  );
}
function contrast(a: string, b: string) {
  return (
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05)
  );
}
test("brand body-text color pairs exceed 4.5:1; this does not certify the entire UI", () => {
  const c = tokens.colors;
  assert.ok(contrast(c.ink, c.canvas) >= 4.5);
  assert.ok(contrast(c.ink, c.cream) >= 4.5);
  assert.ok(contrast(c.cream, c.sidebar) >= 4.5);
});
test("mascot is a transparent PNG and font license notices ship with the app", () => {
  const png = readFileSync(tokens.mascotAsset);
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.subarray(12, 16).toString(), "IHDR");
  assert.ok(
    [4, 6].includes(png[25]),
    "PNG must include a grayscale or RGBA alpha channel",
  );
  assert.ok(existsSync("public/licenses/Archivo-Black-OFL.txt"));
  assert.ok(existsSync("public/licenses/DM-Sans-OFL.txt"));
  assert.equal(tokens.hasLLMInference, true);
  assert.equal(tokens.hasSpeech, true);
});
