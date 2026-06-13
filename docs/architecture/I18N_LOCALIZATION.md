# Web I18n and Localization

| Field                 | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Status                | `active`                                                              |
| Role                  | `web localization boundary guide`                                     |
| Source of truth       | `apps/web/src/app/i18n/*` and `scripts/check-web-i18n-hardcoding.mjs` |
| Last verified against | `2026-06-13` i18n infrastructure and Korean resource migration        |
| When to update        | Locale contracts, string ownership, or hardcoded-copy exceptions change |

Work Archive's first localization phase builds the structure for multiple UI
locales while keeping the shipped interface Korean-only. User-generated content,
catalog titles, tags, reviews, import source text, and provider data are not
translated automatically.

## Locale Contract

The client locale contract lives under `apps/web/src/app/i18n`.

- `AppLocale` is fixed to `ko`, `en`, `ja`, and `zh-CN`.
- `SUPPORTED_LOCALES` lists every locale type that the client can represent.
- `ENABLED_LOCALES` controls which locales are visible in product UI.
- `DEFAULT_LOCALE` is `ko`.
- The selected locale is stored in `localStorage` under
  `work-archive.ui.locale`.
- Runtime resource bundles are registered in
  `apps/web/src/app/i18n/resources/index.ts`.

Only reviewed, complete translations may be added to `ENABLED_LOCALES`. Do not
ship empty or placeholder locale resources for English, Japanese, or Chinese.

## String Ownership

User-facing web copy belongs in `apps/web/src/app/i18n/resources/ko.ts`.
Components should use `useAppTranslation()`. Non-component client code that
needs runtime copy, such as local migration seed data or parsing errors, may use
the shared `appI18n` instance.

Use locale-aware formatting helpers for UI output:

- `formatAppDate`
- `formatAppDateTime`
- `formatAppNumber`

Keep search, sorting, provider request language, and local-first data policies
separate from UI localization unless a later phase explicitly changes those
contracts.

## Hardcoded Korean Guard

Run `npm run check:web-i18n` when changing web UI copy. The check scans
production TypeScript and TSX files for Korean string literals and JSX text, and
fails when user-facing copy is outside the translation resource.

Run `npm run check:web-i18n-resources` when adding or changing locale resource
files. The check compares every present locale resource against the Korean
baseline shape and fails on missing keys, extra keys, type mismatches, unexpected
resource filenames, untranslated Korean inside non-Korean resources, interpolation
placeholder mismatches, or an enabled locale without a resource file.

Run `npm run check:web-i18n-packs` when adding or changing reviewed translation
packs under `docs/i18n/reviewed/`. Translation packs are non-runtime staging
artifacts for complete section batches. The check fails on missing locale
translations, missing keys, extra keys, Korean text in non-Korean translations,
empty values, or interpolation placeholder mismatches.

Allowed hardcoded Korean exceptions must stay narrow and justified in
`scripts/check-web-i18n-hardcoding.mjs`. Current exceptions are:

- `apps/web/src/app/i18n/locales.ts`: native language labels.
- `apps/web/src/app/i18n/resources/ko.ts`: Korean translation resource.
- `apps/web/src/features/imports/services/csv-import.service.ts`: CSV import
  parser aliases for Korean headers and status values.
- `apps/web/src/shared/utils/korean-particle.ts`: Korean grammar helper used by
  translated strings.

Regexes, comments, and test assertions are not the source of product copy. If a
new production Korean string is intentional, prefer moving it into the i18n
resource before adding another exception.

Use `npm run i18n:summary` to inspect the Korean resource by top-level section
before planning a translation batch. The summary includes string counts and
interpolation placeholder usage.

Use `npm run i18n:export-work-pack -- <section>` to export Korean source strings
as JSONL for translation review. The optional section argument matches a top-level
resource path such as `common`, `auth`, `works`, or `settings`. Use
`npm run i18n:export-work-pack -- <section> --summary` to summarize only one
section.

Sequential translation workflow:

1. Run `npm run i18n:summary` and choose a bounded section.
2. Export that section with `npm run i18n:export-work-pack -- <section>`.
3. Add the reviewed section batch under `docs/i18n/reviewed/` and run
   `npm run check:web-i18n-packs`.
4. Keep reviewed packs out of runtime until the locale is complete enough to
   satisfy the baseline shape.
5. Add the full locale file under `apps/web/src/app/i18n/resources/`, register
   it in `resources/index.ts`, and run `npm run check:web-i18n-resources`.
6. Add the locale to `ENABLED_LOCALES` only after product copy has been reviewed
   and the settings UI has been visually verified.

## Future Content Localization

Content-name localization is a separate product and data-model phase. Do not add
direct multilingual fields to `CatalogTitle` as a shortcut. A later phase should
design a dedicated localization model/API and review display fallback order,
such as requested locale, Korean, display title, then original title.
