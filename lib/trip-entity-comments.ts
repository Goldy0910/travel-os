import type { EntityCommentDTO } from "@/app/app/trip/[id]/_components/entity-comments-block";

export type MemberLabelRow = {
  user_id: string | null;
  name: string | null;
  email: string | null;
};

export function memberDisplayLabel(m: MemberLabelRow): string {
  const name = typeof m.name === "string" ? m.name.trim() : "";
  if (name.length > 0) return name;
  const email = typeof m.email === "string" ? m.email.trim() : "";
  if (email.length > 0) return email.split("@")[0] ?? email;
  return "Member";
}

export function groupCommentsByEntityId(
  rows: EntityCommentDTO[],
): Record<string, EntityCommentDTO[]> {
  const map: Record<string, EntityCommentDTO[]> = {};
  for (const c of rows) {
    const key = String(c.entity_id);
    if (!map[key]) map[key] = [];
    map[key]!.push(c);
  }
  for (const k of Object.keys(map)) {
    map[k]!.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }
  return map;
}
