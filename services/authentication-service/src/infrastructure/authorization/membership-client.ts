import { z } from "zod";
import { config } from "../../config/environment.js";
import { currentTraceparent, withSpan } from "../../platform/telemetry.js";

const membershipSchema = z.object({
  objectId: z.string().min(1).max(128).regex(/^[^:#\r\n\u0000]+$/),
});

export async function writeEmployeeGroupMembership(objectId: string, groupKey: string): Promise<void> {
  return withSpan(
    "authorization.employee_group.ensure",
    { "http.request.method": "POST", "http.route": "/v1/membership" },
    () => writeMembershipRequest(objectId, groupKey),
  );
}

async function writeMembershipRequest(objectId: string, groupKey: string): Promise<void> {
  if (!config.provisioningToken) {
    throw new Error("IDENTITY_PROVISIONING_TOKEN is missing");
  }

  const payload = membershipSchema.extend({ groupKey: z.literal("all-employees") }).parse({ objectId, groupKey });
  const traceparent = currentTraceparent();
  const response = await fetch(`${config.authorizationUrl.replace(/\/$/, "")}/v1/membership`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGSI-Service-Token": config.provisioningToken,
      ...(traceparent ? { traceparent } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Authorization membership request returned ${response.status}`);
  }
}
