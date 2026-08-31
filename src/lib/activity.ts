import { getDB } from "@/lib/d1";
import type { SessionPayload } from "@/lib/auth";

export async function recordActivity({
  session,
  entity,
  entityId,
  action,
  summary,
  metadata,
}: {
  session?: SessionPayload | null;
  entity: "po" | "setoran" | "auth" | "payroll" | "order";
  entityId?: number | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDB();
  await db
    .prepare(
      `INSERT INTO activity_logs (user_id, entity, entity_id, action, summary, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(
      session?.userId ?? null,
      entity,
      entityId ?? null,
      action,
      summary,
      metadata ? JSON.stringify(metadata) : null
    )
    .run();
}
