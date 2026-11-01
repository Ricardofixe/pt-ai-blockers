// copies the reference lists (src/sites.ts and src/bots.ts) into the database
// only inserts new rows and updates

import { SITES } from "./sites";
import { BOTS } from "./bots";

export async function syncReferenceData(db: D1Database): Promise<void> {
  // insert the row, or update it instead
  const upsertSite = db.prepare(
    `INSERT INTO sites (domain, name, sector)
     VALUES (?, ?, ?)
     ON CONFLICT (domain) DO UPDATE SET
       name = excluded.name,
       sector = excluded.sector`,
  );

  const upsertBot = db.prepare(
    `INSERT INTO bots (name, operator, purpose, deprecated, source_url)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (name) DO UPDATE SET
       operator = excluded.operator,
       purpose = excluded.purpose,
       deprecated = excluded.deprecated,
       source_url = excluded.source_url`,
  );

  const statements = [
    ...SITES.map((s) => upsertSite.bind(s.domain, s.name, s.sector)),
    ...BOTS.map((b) =>
      upsertBot.bind(
        b.name,
        b.operator,
        b.purpose,
        b.deprecated ? 1 : 0,
        b.sourceUrl,
      ),
    ),
  ];

  await db.batch(statements);
}
