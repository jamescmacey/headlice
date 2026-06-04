-- News records scraped from configured sites.
-- id may be set explicitly when importing existing rows; AUTOINCREMENT applies to new inserts.
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  story_url TEXT NOT NULL,
  image_url TEXT,
  site TEXT NOT NULL CHECK (site IN ('rnz')),
  retrieved TEXT NOT NULL
);

CREATE INDEX idx_records_site_retrieved ON records (site, retrieved DESC);

CREATE INDEX idx_records_story_url ON records (story_url);
