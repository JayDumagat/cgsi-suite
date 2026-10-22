import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthenticationService, constantTimeMatch } from "./service.js";
import type { AuthTransaction } from "./contracts.js";
import type { AuthenticationProvider } from "./ports.js";

const settings = {
  tenantId: "tenant-1",
  clientId: "client-1",
  sessionMaxAgeSeconds: 300,
};

function createHarness(overrides: {
  configured?: boolean;
  claims?: Record<string, unknown>;
  employeeActive?: boolean;
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = overrides.claims ?? {
    oid: "employee-oid",
    tid: "TENANT-1",
    aud: "CLIENT-1",
    nonce: "expected-nonce",
    exp: now + 3600,
    email: "Employee@Example.com",
    name: " Employee Name ",
  };
  let provisionedProfile: unknown;
  const baselineGrants: string[] = [];
  const provider: AuthenticationProvider = {
    isConfigured: overrides.configured ?? true,
    async generatePkceCodes() { return { challenge: "challenge", verifier: "verifier" }; },
    async authorizationUrl() { return "https://login.microsoftonline.com/authorize"; },
    async redeemAuthorizationCode() { return claims; },
    logoutUrl() { return null; },
  };
  const service = new AuthenticationService(
    provider,
    {
      async provision(profile) {
        provisionedProfile = profile;
        return { employeeId: "local-employee-1", active: overrides.employeeActive ?? true };
      },
    },
    { async ensureBaselineAccess(employeeId) { baselineGrants.push(employeeId); } },
    settings,
  );
  const transaction: AuthTransaction = {
    state: "state",
    nonce: "expected-nonce",
    codeVerifier: "verifier",
    returnTo: "/",
    createdAt: Date.now(),
  };
  return { service, transaction, baselineGrants, claims, get provisionedProfile() { return provisionedProfile; }, now };
}

describe("AuthenticationService", () => {
  it("creates a PKCE transaction for configured Microsoft sign-in", async () => {
    const { service } = createHarness();
    const signIn = await service.beginSignIn("/");

    assert.match(signIn.authorizationUrl, /^https:\/\//);
    assert.ok(signIn.transaction.state.length > 32);
    assert.equal(signIn.transaction.codeVerifier, "verifier");
  });

  it("provisions a validated employee and clamps the session lifetime", async () => {
    const harness = createHarness();
    const user = await harness.service.completeSignIn("auth-code", harness.transaction);

    assert.equal(user?.employeeId, "local-employee-1");
    assert.equal(user?.oid, "employee-oid");
    assert.ok(user!.expiresAt <= harness.now + settings.sessionMaxAgeSeconds + 1);
    assert.deepEqual(harness.provisionedProfile, {
      tenantId: "TENANT-1",
      objectId: "employee-oid",
      email: "employee@example.com",
      displayName: "Employee Name",
    });
    assert.deepEqual(harness.baselineGrants, ["local-employee-1"]);
  });

  it("rejects a token from a different tenant before provisioning", async () => {
    const harness = createHarness({ claims: { ...createHarness().claims, tid: "other-tenant" } });

    assert.equal(await harness.service.completeSignIn("auth-code", harness.transaction), null);
    assert.equal(harness.provisionedProfile, undefined);
    assert.deepEqual(harness.baselineGrants, []);
  });

  it("rejects a nonce mismatch before provisioning", async () => {
    const harness = createHarness({ claims: { ...createHarness().claims, nonce: "wrong-nonce" } });

    assert.equal(await harness.service.completeSignIn("auth-code", harness.transaction), null);
    assert.equal(harness.provisionedProfile, undefined);
  });

  it("does not create access for a disabled employee", async () => {
    const harness = createHarness({ employeeActive: false });

    assert.equal(await harness.service.completeSignIn("auth-code", harness.transaction), null);
    assert.deepEqual(harness.baselineGrants, []);
  });

  it("rejects an expired identity token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const harness = createHarness({ claims: { ...createHarness().claims, exp: now - 1 } });

    assert.equal(await harness.service.completeSignIn("auth-code", harness.transaction), null);
    assert.equal(harness.provisionedProfile, undefined);
  });
});

describe("constantTimeMatch", () => {
  it("matches non-empty equal values and rejects empty or different values", () => {
    assert.equal(constantTimeMatch("state", "state"), true);
    assert.equal(constantTimeMatch("state", "other"), false);
    assert.equal(constantTimeMatch("", ""), false);
  });
});
