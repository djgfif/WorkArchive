# Private Codex Sites POC

| Field | Value |
| --- | --- |
| Status | Experimental, private validation only |
| Owners | Work Archive maintainers |
| Apps | apps/site and apps/web |
| Data | Disposable, browser-local IndexedDB |
| Production authority | None |

## Purpose

This POC lets invited reviewers understand Work Archive on a read-only product
site, then open a guest-only copy of the real app and create local records. It
does not replace the Docker beta host, production deployment, or any release
gate.

Two independent private Sites projects are used:

1. apps/site: a single product introduction page with fictional sample data.
2. apps/web: the existing app built with the sites-guest-poc profile.

Both URLs must remain private. Do not attach a public domain, public sharing
mode, analytics, authentication, or production credentials.

## Capability Boundary

The app POC keeps manual create, edit, delete, restore, progress, ratings, tags,
timeline, insights, tier boards, and JSON backup. Its data belongs only to the
browser and deployment origin where it was created.

The profile disables or removes:

- session recovery and automatic sync;
- login, account transfer, account sync, OAuth, and Notion;
- external and server-backed search;
- API access, which returns 503 API_NOT_CONFIGURED for every /api request;
- service-worker registration and PWA installation;
- production diagnostics and public sharing entry points.

No PostgreSQL, NestJS API, D1, R2, cookies, analytics, or external connectors
are part of this deployment. A Sites URL change creates a different IndexedDB
origin. Do not migrate production data into or out of the POC.

## Local Commands

Use the repository runtime and root lockfile:

    source ~/.nvm/nvm.sh
    nvm use
    npm install

Run or verify the product site:

    npm run dev --workspace @work-archive/site
    npm run typecheck --workspace @work-archive/site
    npm run test --workspace @work-archive/site

Build the guest app worker:

    npm run build:sites --workspace @work-archive/web
    node --test apps/web/sites/worker.test.mjs

The normal web dev, build, Docker, and Nginx paths remain unchanged.

## Configuration and Metadata

APP_POC_URL is optional for apps/site. When it is absent or invalid, the
secondary CTA reads “앱 POC 준비 중” and is not interactive. Set it to the
private app URL before the final product-site build or as a Sites runtime value.

Each app owns .openai/hosting.json. The tracked file may contain only:

    { "project_id": "the-sites-project-id" }

Never store write credentials, access tokens, deployment URLs containing
credentials, or other secrets in that file.

## Private Deployment Order

1. Run the repository and targeted checks below.
2. Create a private Sites project for apps/web.
3. Build apps/web with build:sites, save a Sites version, and deploy privately.
4. Verify the app URL, including a deep-link refresh.
5. Set APP_POC_URL to that private URL for apps/site.
6. Build apps/site, create its separate Sites project, save a version, and
   deploy privately.
7. Confirm both URLs remain private and the product-site CTA opens the app URL.

Do not continue with a shared or public deployment if private deployment is
unavailable.

## Required Verification

Repository checks:

    npm run lint
    npm run typecheck
    npm run test
    npm run build
    npm run check:web-boundaries
    npm run check:web-import-cycles
    npm run check:docs-links
    npm run security:public

Browser checks at 1440 × 900 and 390 × 844:

- product copy, demo tabs, keyboard focus, CTA state, contrast, touch targets,
  and horizontal overflow;
- fixed POC notice, no login or server-search entry point, and no unexpected
  /api request;
- console free of unexpected errors.

App scenario:

1. Open a fresh browser context and confirm immediate guest access.
2. Create “겨울 궤도” manually.
3. Edit progress, rating, and tags.
4. Refresh and confirm the IndexedDB record remains.
5. Delete and restore it.
6. Confirm timeline and insights reflect the change.
7. Open and refresh a deep route such as /works/new.
