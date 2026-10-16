import assert from "node:assert/strict";

const port = process.env.HTTP_PORT || "8080";
const baseUrl = new URL(process.env.CGSI_SMOKE_BASE_URL || `http://localhost:${port}`);

async function request(path) {
  return fetch(new URL(path, baseUrl), {
    headers: { Accept: "application/json, text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  });
}

async function waitForGateway() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await request("/healthz");
      if (response.ok) return;
      lastError = new Error(`gateway health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`gateway did not become healthy: ${lastError}`);
}

await waitForGateway();

const gatewayHealth = await request("/healthz");
assert.equal(gatewayHealth.status, 200);
assert.equal((await gatewayHealth.json()).status, "ok");

const cube = await request("/");
assert.equal(cube.status, 200, "Cube must be served by the gateway");
const html = await cube.text();
assert.match(html, /<div[^>]+id=["']root["']/i, "Cube must contain its React mount point");
const entryAssets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)]
  .map((match) => match[1]);
assert.ok(entryAssets.some((asset) => asset.includes(".js")), "Cube must reference its entry JavaScript");
for (const asset of entryAssets) {
  const response = await request(asset);
  assert.equal(response.status, 200, `frontend asset ${asset} should be served`);
}

const session = await request("/api/auth/session");
assert.equal(session.status, 401, "an anonymous session lookup should be unauthenticated");

const catalog = await request("/api/v1/apps");
assert.equal(catalog.status, 401, "the app catalog should require an employee session");

console.log("Compose smoke checks passed: gateway, Cube entry/assets, identity session, and catalog auth boundary.");
