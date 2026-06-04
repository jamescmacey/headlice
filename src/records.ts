/** Allowed `records.site` values. Extend the CHECK in migrations when adding sites. */
export type RecordSite = 'rnz';

export interface RecordRow {
  id: number;
  headline: string;
  summary: string;
  story_url: string;
  image_url: string | null;
  site: RecordSite;
  /** ISO 8601 datetime stored as TEXT in D1/SQLite. */
  retrieved: string;
}

export interface NewRecord {
  headline: string;
  summary: string;
  story_url: string;
  image_url?: string | null;
  site: RecordSite;
  retrieved: string;
}

const RECORD_COLUMNS =
  'id, headline, summary, story_url, image_url, site, retrieved';

/**
 * Return one random row using the primary key index.
 *
 * Picks a random id in [MIN(id), MAX(id)] then fetches the first row at or
 * after that id. This is O(log n) via the PK B-tree; no extra index is needed.
 * Id gaps slightly bias selection toward higher ids (each row is still reachable).
 */
export async function insertRecord(
  db: D1Database,
  record: NewRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO records (headline, summary, story_url, image_url, site, retrieved)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.headline,
      record.summary,
      record.story_url,
      record.image_url ?? null,
      record.site,
      record.retrieved,
    )
    .run();
}

export async function getRandomRecord(
  db: D1Database,
): Promise<RecordRow | null> {
  return (
    (await db
      .prepare(
        `SELECT ${RECORD_COLUMNS}
         FROM records
         WHERE id >= (
           SELECT CAST(
             (SELECT MIN(id) FROM records) +
             ABS(RANDOM()) % MAX(1, (SELECT MAX(id) FROM records) - (SELECT MIN(id) FROM records) + 1)
           AS INTEGER)
         )
         ORDER BY id ASC
         LIMIT 1`,
      )
      .first<RecordRow>()) ?? null
  );
}
