import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTarget,
  isPublicIP,
  assertPublicTarget,
  requestAllowed,
} from "../server/security.js";

for (const target of [
  "file:///etc/passwd",
  "javascript:alert(1)",
  "https://user:pass@example.com",
  "https://example.com:4310",
  "example.com",
  "",
]) {
  test(`invalid target rejected: ${target}`, () =>
    assert.throws(() => parseTarget(target)));
}
test("URL normalized and fragments removed, query retained", () => {
  assert.equal(
    parseTarget("https://EXAMPLE.com/path?lang=de#top").href,
    "https://example.com/path?lang=de",
  );
});
for (const ip of [
  "127.0.0.1",
  "10.2.3.4",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.64.0.1",
  "0.0.0.0",
  "255.255.255.255",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fe80::1",
  "2002:7f00:1::",
  "invalid",
]) {
  test(`non-public address blocked: ${ip}`, () =>
    assert.equal(isPublicIP(ip), false));
}
test("public addresses accepted", () => {
  assert.equal(isPublicIP("8.8.8.8"), true);
  assert.equal(isPublicIP("2606:4700:4700::1111"), true);
  assert.equal(isPublicIP("192.0.78.17"), true);
  assert.equal(isPublicIP("2001:4860:4860::8888"), true);
  assert.equal(isPublicIP("192.0.0.1"), false);
  assert.equal(isPublicIP("2001:db8::1"), false);
});
test("localhost names and direct private addresses rejected", async () => {
  await assert.rejects(assertPublicTarget(new URL("http://localhost")));
  await assert.rejects(assertPublicTarget(new URL("http://127.0.0.1")));
  await assert.rejects(assertPublicTarget(new URL("http://[::1]")));
});
test("exact Host and same-origin checks protect local API", () => {
  assert.equal(requestAllowed("127.0.0.1:4310", undefined, 4310), true);
  assert.equal(
    requestAllowed("localhost:4310", "http://localhost:4310", 4310),
    true,
  );
  assert.equal(requestAllowed("evil.example:4310", undefined, 4310), false);
  assert.equal(
    requestAllowed("localhost:4310", "https://evil.example", 4310),
    false,
  );
  assert.equal(requestAllowed("localhost:4311", undefined, 4310), false);
});
