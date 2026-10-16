import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(appRoot, "dist");

test("production bundle has an HTML entry and resolvable local assets", async () => {
  const html = await readFile(path.join(dist, "index.html"), "utf8");
  assert.match(html, /<div[^>]+id=["']root["']/i, "React mount point must be present");

  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((reference) => /\.(?:js|css)(?:\?|$)/i.test(reference));
  assert.ok(assets.some((reference) => /\.js(?:\?|$)/i.test(reference)), "entry script must be linked");

  for (const reference of assets) {
    const filename = path.posix.basename(new URL(reference, "http://localhost").pathname);
    await access(path.join(dist, "assets", filename));
  }
});
