import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runFixLab } from "../server/services/fix-lab.js";

test(
  "real offline Chromium lab measures a width fix, ineffective minimum, rename effects and isolation",
  { timeout: 60000 },
  async () => {
    let requests = 0;
    const sentinel = createServer((_request, response) => {
      requests++;
      response.end("");
    });
    await new Promise<void>((resolve) =>
      sentinel.listen(0, "127.0.0.1", resolve),
    );
    const address = sentinel.address();
    assert.ok(address && typeof address === "object");
    const external = `http://127.0.0.1:${address.port}/external`;
    const html = `<style>@import url("${external}"); body{margin:0} #menu,.wide{width:680px;background:#ddd;border-right:12px solid #111;box-sizing:border-box} #menu button{visibility:visible} .wide summary{visibility:visible}</style>
    <script>fetch("${external}"); document.body.innerHTML=""</script><img src="${external}">
    <a href="#menu">Navigation</a><a href="${external}">Outside</a>
    <nav id="menu"><button onclick="fetch('${external}')">Contact</button></nav>`;
    const input = {
      html,
      target: "#menu",
      viewportId: "mobile",
      acknowledged: true,
    };
    try {
      const fix = await runFixLab({
        ...input,
        operation: { type: "css", property: "max-width", value: "100%" },
      });
      assert.ok(fix.before.documentOverflow > 0);
      assert.equal(fix.after.documentOverflow, 0);
      assert.equal(fix.after.visibleControls, fix.before.visibleControls);
      assert.equal(fix.before.unresolvedAnchors, 0);
      assert.notEqual(fix.originalImage, fix.changedImage);
      const ineffective = await runFixLab({
        ...input,
        operation: { type: "css", property: "min-width", value: "0" },
      });
      assert.deepEqual(ineffective.before, ineffective.after);
      const renamed = await runFixLab({
        ...input,
        operation: { type: "rename", value: "other" },
      });
      assert.equal(renamed.after.unresolvedAnchors, 1);
      assert.equal(renamed.after.documentOverflow, 0);
      const classes = await runFixLab({
        ...input,
        target: ".wide",
        html: "<style>.wide{width:680px}.narrow{visibility:hidden}</style><details class=wide open><summary>Details</summary><button>Action</button></details>",
        operation: { type: "rename", value: "narrow" },
      });
      assert.ok(classes.before.visibleControls > 0);
      assert.equal(classes.after.visibleControls, 0);
      assert.equal(requests, 0);
      await assert.rejects(
        runFixLab({ ...input, acknowledged: false }),
        /Freigegebener/,
      );
      await assert.rejects(
        runFixLab({
          ...input,
          operation: {
            type: "css",
            property: "width",
            value: "url(http://invalid)",
          },
        }),
        /CSS-Werte/,
      );
    } finally {
      await new Promise<void>((resolve) => sentinel.close(() => resolve()));
    }
  },
);
