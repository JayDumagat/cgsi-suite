import TokenModel from "/app/models/token.js";
import db from "/app/db.js";
import userModel from "/app/models/user.js";

const apiUrl = process.env.NPM_API_URL ?? "http://nginx-proxy-manager:81/api";
const adminEmail = process.env.NPM_ADMIN_EMAIL;
const adminPassword = process.env.NPM_ADMIN_PASSWORD;
const localhostNames = ["localhost", "127.0.0.1"];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`NPM API request ${options.method ?? "GET"} ${path} returned HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined;
  return response.json();
}

async function waitForNpm() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/tokens`, { method: "OPTIONS" });
      if (response.ok || response.status === 204) return;
    } catch {
      // The manager may be healthy before its API has finished starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("NPM API did not become available after 60 attempts");
}

async function getAdminUser() {
  const activeUsers = await userModel
    .query()
    .where("is_deleted", 0)
    .andWhere("is_disabled", 0)
    .select("id", "email", "roles");

  if (activeUsers.length === 0) {
    if (!adminEmail || !adminPassword) {
      throw new Error("Set NPM_ADMIN_EMAIL and NPM_ADMIN_PASSWORD to initialize a fresh NPM data volume");
    }

    await apiRequest("/users", {
      method: "POST",
      body: JSON.stringify({
        name: "CGSI Administrator",
        nickname: "CGSI Admin",
        email: adminEmail,
        roles: ["admin"],
        is_disabled: false,
        auth: { type: "password", secret: adminPassword },
      }),
    });

    console.info("Created the first NPM administrator from local .env settings");
    return getAdminUser();
  }

  const admin = activeUsers.find((user) => user.roles?.includes("admin"));
  if (!admin) {
    throw new Error("NPM has active users but no administrator account; promote an account in the NPM UI first");
  }

  return admin;
}

await waitForNpm();
const admin = await getAdminUser();
const tokenResult = await TokenModel().create({
  iss: "cgsi-local-bootstrap",
  attrs: { id: admin.id },
  scope: ["user", "admin"],
  expiresIn: "5m",
});
const headers = { authorization: `Bearer ${tokenResult.token}` };
const hosts = await apiRequest("/nginx/proxy-hosts", { headers });
const matchingHosts = hosts.filter((host) =>
  host.domain_names?.some((domain) => localhostNames.includes(domain)),
);

if (matchingHosts.length > 1) {
  throw new Error("Multiple NPM proxy hosts already claim localhost or 127.0.0.1; resolve the duplicate in the NPM UI");
}

const host = matchingHosts[0];
const connected =
  host?.forward_scheme === "http" &&
  host.forward_host === "gateway" &&
  host.forward_port === 80 &&
  host.enabled &&
  localhostNames.every((domain) => host.domain_names.includes(domain));

if (connected) {
  console.info("NPM localhost proxy host already forwards to gateway:80");
} else if (host) {
  await apiRequest(`/nginx/proxy-hosts/${host.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      domain_names: localhostNames,
      forward_scheme: "http",
      forward_host: "gateway",
      forward_port: 80,
      enabled: true,
    }),
  });
  console.info("Updated NPM localhost proxy host to forward to gateway:80");
} else {
  await apiRequest("/nginx/proxy-hosts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      domain_names: localhostNames,
      forward_scheme: "http",
      forward_host: "gateway",
      forward_port: 80,
      access_list_id: 0,
      certificate_id: 0,
      ssl_forced: false,
      hsts_enabled: false,
      hsts_subdomains: false,
      trust_forwarded_proto: false,
      http2_support: false,
      block_exploits: true,
      caching_enabled: false,
      allow_websocket_upgrade: true,
      advanced_config: "",
      enabled: true,
      locations: [],
    }),
  });
  console.info("Created NPM localhost proxy host forwarding to gateway:80");
}

await db().destroy();
