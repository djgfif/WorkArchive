CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION catalog_title_search_text(
  canonical_title text,
  display_title text,
  original_title text,
  aliases text[]
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    concat_ws(
      ' ',
      canonical_title,
      display_title,
      coalesce(original_title, ''),
      array_to_string(aliases, ' ')
    )
  );
$$;

CREATE OR REPLACE FUNCTION contributor_search_text(
  canonical_name text,
  display_name text,
  aliases text[]
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    concat_ws(
      ' ',
      canonical_name,
      display_name,
      array_to_string(aliases, ' ')
    )
  );
$$;

CREATE INDEX IF NOT EXISTS "catalog_titles_title_search_trgm_idx"
ON "catalog_titles"
USING GIN (catalog_title_search_text(
  "canonicalTitle",
  "displayTitle",
  "originalTitle",
  "aliases"
) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "catalog_titles_title_search_fts_idx"
ON "catalog_titles"
USING GIN (to_tsvector('simple', catalog_title_search_text(
  "canonicalTitle",
  "displayTitle",
  "originalTitle",
  "aliases"
)));

CREATE INDEX IF NOT EXISTS "contributors_name_search_trgm_idx"
ON "contributors"
USING GIN (contributor_search_text(
  "canonicalName",
  "displayName",
  "aliases"
) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "contributors_name_search_fts_idx"
ON "contributors"
USING GIN (to_tsvector('simple', contributor_search_text(
  "canonicalName",
  "displayName",
  "aliases"
)));
