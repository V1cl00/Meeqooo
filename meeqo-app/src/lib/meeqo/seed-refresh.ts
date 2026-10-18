/**
 * Testdaten (Migration 0033): hält die seed-Treffen frisch, damit der Feed nie veraltet.
 * period_days = 0: startet immer bald (offset_min ab jetzt), sobald es 30 Minuten läuft.
 * period_days > 0: rückt um ganze Perioden vor, sobald es 2 Stunden vorbei ist.
 * Höchstens alle 10 Minuten pro Instanz. Fehlt die Tabelle (Seeds entfernt), passiert nichts.
 */
import type { Sql } from "@/lib/db";

let last = 0;

export async function refreshSeeds(sql: Sql) {
  if (Date.now() - last < 10 * 60_000) return;
  last = Date.now();
  try {
    await sql`
      update activities a set starts_at = date_trunc('minute', now()) + make_interval(mins => s.offset_min)
      from seed_schedule s
      where a.id = s.activity_id and s.period_days = 0 and a.starts_at < now() - interval '30 minutes'
    `;
    await sql`
      update activities a set starts_at = a.starts_at + make_interval(days => s.period_days * ceil(extract(epoch from (now() - interval '2 hours' - a.starts_at)) / (s.period_days * 86400))::int)
      from seed_schedule s
      where a.id = s.activity_id and s.period_days > 0 and a.starts_at < now() - interval '2 hours'
    `;
    await sql`update ideas set created_at = now() - interval '1 day' where id like 'idea-s-%' and created_at < now() - interval '20 days'`;
  } catch {
    // seed_schedule fehlt: keine Testdaten
  }
}
