CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "catalog_titles_title_search_trgm_idx"
ON "catalog_titles"
USING GIN (
  (
    lower(
      concat_ws(
        ' ',
        "canonicalTitle",
        "displayTitle",
        coalesce("originalTitle", ''),
        array_to_string("aliases", ' ')
      )
    )
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS "catalog_titles_title_search_fts_idx"
ON "catalog_titles"
USING GIN (
  to_tsvector(
    'simple',
    concat_ws(
      ' ',
      "canonicalTitle",
      "displayTitle",
      coalesce("originalTitle", ''),
      array_to_string("aliases", ' ')
    )
  )
);

CREATE INDEX IF NOT EXISTS "contributors_name_search_trgm_idx"
ON "contributors"
USING GIN (
  (
    lower(
      concat_ws(
        ' ',
        "canonicalName",
        "displayName",
        array_to_string("aliases", ' ')
      )
    )
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS "contributors_name_search_fts_idx"
ON "contributors"
USING GIN (
  to_tsvector(
    'simple',
    concat_ws(
      ' ',
      "canonicalName",
      "displayName",
      array_to_string("aliases", ' ')
    )
  )
);
