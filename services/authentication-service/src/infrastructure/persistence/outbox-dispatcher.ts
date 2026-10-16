import type { Pool } from "pg";

interface MembershipEvent {
  id: string;
  payload: { objectId?: unknown; groupKey?: unknown };
}

type MembershipWriter = (objectId: string, groupKey: string) => Promise<void>;

export class AuthorizationOutboxDispatcher {
  constructor(private readonly pool: Pool, private readonly writeMembership: MembershipWriter) {}

  async dispatchPending(employeeId?: string, limit = 20): Promise<void> {
    const events = await this.claim(employeeId, limit);
    for (const event of events) {
      const objectId = typeof event.payload.objectId === "string" ? event.payload.objectId : "";
      const groupKey = typeof event.payload.groupKey === "string" ? event.payload.groupKey : "";
      if (!objectId || !groupKey) {
        await this.fail(event.id, "invalid_authorization_event");
        continue;
      }

      try {
        await this.writeMembership(objectId, groupKey);
        await this.pool.query(
          `UPDATE platform.outbox_events
              SET delivered_at = now(), locked_until = NULL, last_error_code = NULL
            WHERE id = $1 AND delivered_at IS NULL`,
          [event.id],
        );
      } catch {
        await this.fail(event.id, "authorization_sync_failed");
      }
    }
    if (employeeId) {
      const pending = await this.pool.query<{ pending: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM platform.outbox_events
            WHERE aggregate_id = $1 AND event_type = 'authorization.employee_group.ensure'
              AND delivered_at IS NULL
         ) AS pending`,
        [employeeId],
      );
      if (pending.rows[0]?.pending) throw new Error("authorization_membership_sync_pending");
    }
  }

  private async claim(employeeId: string | undefined, limit: number): Promise<MembershipEvent[]> {
    const result = await this.pool.query<MembershipEvent>(
      `WITH due AS (
         SELECT id FROM platform.outbox_events
          WHERE event_type = 'authorization.employee_group.ensure'
            AND delivered_at IS NULL AND available_at <= now()
            AND (locked_until IS NULL OR locked_until < now())
            AND ($1::text IS NULL OR aggregate_id = $1)
          ORDER BY available_at, created_at
          FOR UPDATE SKIP LOCKED
          LIMIT $2
       )
       UPDATE platform.outbox_events AS event
          SET locked_until = now() + interval '30 seconds', attempts = attempts + 1
         FROM due
        WHERE event.id = due.id
       RETURNING event.id, event.payload`,
      [employeeId ?? null, limit],
    );
    return result.rows;
  }

  private async fail(eventId: string, code: string): Promise<void> {
    await this.pool.query(
      `UPDATE platform.outbox_events
          SET locked_until = NULL,
              last_error_code = $2,
              available_at = now() + make_interval(secs => LEAST(300, power(2, attempts))::integer)
        WHERE id = $1 AND delivered_at IS NULL`,
      [eventId, code],
    );
  }
}
