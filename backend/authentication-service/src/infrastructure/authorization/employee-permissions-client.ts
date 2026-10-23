import { z } from "zod";
import { config } from "../../config/environment.js";
import { currentTraceparent, withSpan } from "../../platform/telemetry.js";

const responseSchema = z.object({ allowed: z.boolean() });

export function canEditEmployeeInformation(objectId: string): Promise<boolean> {
  return withSpan(
    "authorization.employee_information.edit.check",
    { "http.request.method": "POST", "http.route": "/v1/check" },
    () => checkEmployeeEditRelationship(objectId),
  );
}

async function checkEmployeeEditRelationship(objectId: string): Promise<boolean> {
  if (!config.authorizationServiceToken) {
    throw new Error("AUTHORIZATION_SERVICE_TOKEN is missing");
  }

  const traceparent = currentTraceparent();
  const response = await fetch(`${config.authorizationUrl.replace(/\/$/, "")}/v1/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CGSI-Service-Token": config.authorizationServiceToken,
      ...(traceparent ? { traceparent } : {}),
    },
    body: JSON.stringify({
      user: `user:${objectId}`,
      relation: "can_edit_employees",
      object: "app:hris",
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Authorization check returned ${response.status}`);
  }
  const result = responseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error("Authorization check returned an invalid result");
  }
  return result.data.allowed;
}
