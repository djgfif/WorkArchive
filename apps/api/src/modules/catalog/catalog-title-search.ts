import { Prisma, type WorkType } from '@prisma/client';

interface CatalogTitleSearchClient {
  $queryRaw?: <T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
  ) => Promise<T>;
}

interface SearchCatalogTitleIdsInput {
  limit: number;
  mediumType?: WorkType;
  query: string;
}

interface CatalogTitleSearchRow {
  id: string;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function searchCatalogTitleIds(
  client: CatalogTitleSearchClient,
  input: SearchCatalogTitleIdsInput,
) {
  if (typeof client.$queryRaw !== 'function') {
    return null;
  }

  const normalizedQuery = input.query.normalize('NFKC').trim();

  if (!normalizedQuery) {
    return [];
  }

  const limit = Math.max(1, Math.min(input.limit, 50));
  const escapedLowerQuery = escapeLikePattern(normalizedQuery.toLowerCase());
  const prefixLikeQuery = `${escapedLowerQuery}%`;
  const containsLikeQuery = `%${escapedLowerQuery}%`;
  const likeEscape = '\\';
  const mediumFilter = input.mediumType
    ? Prisma.sql`t."mediumType" = ${input.mediumType}::"WorkType" AND`
    : Prisma.empty;

  const rows = await client.$queryRaw<CatalogTitleSearchRow[]>(Prisma.sql`
    WITH ranked_titles AS (
      SELECT
        t.id,
        (
          CASE WHEN lower(t."displayTitle") = lower(${normalizedQuery}) THEN 1200 ELSE 0 END +
          CASE WHEN lower(t."canonicalTitle") = lower(${normalizedQuery}) THEN 1000 ELSE 0 END +
          CASE WHEN lower(coalesce(t."originalTitle", '')) = lower(${normalizedQuery}) THEN 900 ELSE 0 END +
          CASE WHEN lower(t."displayTitle") LIKE ${prefixLikeQuery} ESCAPE ${likeEscape} THEN 360 ELSE 0 END +
          CASE WHEN lower(t."canonicalTitle") LIKE ${prefixLikeQuery} ESCAPE ${likeEscape} THEN 320 ELSE 0 END +
          ts_rank_cd(
            to_tsvector(
              'simple',
              catalog_title_search_text(
                t."canonicalTitle",
                t."displayTitle",
                t."originalTitle",
                t."aliases"
              )
            ),
            plainto_tsquery('simple', ${normalizedQuery})
          ) * 160 +
          greatest(
            similarity(lower(t."displayTitle"), lower(${normalizedQuery})),
            similarity(lower(t."canonicalTitle"), lower(${normalizedQuery})),
            similarity(lower(coalesce(t."originalTitle", '')), lower(${normalizedQuery})),
            similarity(lower(array_to_string(t."aliases", ' ')), lower(${normalizedQuery}))
          ) * 120 +
          coalesce(
            (
              SELECT max(
                CASE
                  WHEN lower(c."displayName") = lower(${normalizedQuery}) THEN 260
                  WHEN lower(c."displayName") LIKE ${prefixLikeQuery} ESCAPE ${likeEscape} THEN 180
                  WHEN contributor_search_text(
                    c."canonicalName",
                    c."displayName",
                    c."aliases"
                  ) LIKE ${containsLikeQuery} ESCAPE ${likeEscape} THEN 120
                  ELSE similarity(
                    contributor_search_text(
                      c."canonicalName",
                      c."displayName",
                      c."aliases"
                    ),
                    lower(${normalizedQuery})
                  ) * 80
                END
              )
              FROM "catalog_title_contributors" ctc
              JOIN "contributors" c ON c.id = ctc."contributorId"
              WHERE ctc."catalogTitleId" = t.id
            ),
            0
          )
        ) AS rank
      FROM "catalog_titles" t
      WHERE
        ${mediumFilter}
        (
          to_tsvector(
            'simple',
            catalog_title_search_text(
              t."canonicalTitle",
              t."displayTitle",
              t."originalTitle",
              t."aliases"
            )
          ) @@ plainto_tsquery('simple', ${normalizedQuery})
          OR catalog_title_search_text(
            t."canonicalTitle",
            t."displayTitle",
            t."originalTitle",
            t."aliases"
          ) LIKE ${containsLikeQuery} ESCAPE ${likeEscape}
          OR greatest(
            similarity(lower(t."displayTitle"), lower(${normalizedQuery})),
            similarity(lower(t."canonicalTitle"), lower(${normalizedQuery})),
            similarity(lower(coalesce(t."originalTitle", '')), lower(${normalizedQuery})),
            similarity(lower(array_to_string(t."aliases", ' ')), lower(${normalizedQuery}))
          ) >= 0.18
          OR EXISTS (
            SELECT 1
            FROM "catalog_title_contributors" ctc
            JOIN "contributors" c ON c.id = ctc."contributorId"
            WHERE
              ctc."catalogTitleId" = t.id
              AND (
                to_tsvector(
                  'simple',
                  contributor_search_text(
                    c."canonicalName",
                    c."displayName",
                    c."aliases"
                  )
                ) @@ plainto_tsquery('simple', ${normalizedQuery})
                OR contributor_search_text(
                  c."canonicalName",
                  c."displayName",
                  c."aliases"
                ) LIKE ${containsLikeQuery} ESCAPE ${likeEscape}
                OR similarity(
                  contributor_search_text(
                    c."canonicalName",
                    c."displayName",
                    c."aliases"
                  ),
                  lower(${normalizedQuery})
                ) >= 0.18
              )
          )
        )
    )
    SELECT id
    FROM ranked_titles
    ORDER BY rank DESC, id ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => row.id);
}
