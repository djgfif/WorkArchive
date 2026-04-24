# Auth Clean Archive Card Stitch Draft

| Field | Value |
| --- | --- |
| Status | `reference-only` |
| Role | `login and register visual exploration` |
| Source of truth | Google Stitch output, root `DESIGN.md`, current `LoginPage`, `RegisterPage`, `AuthPageTemplate`, and `AuthForm` implementation |
| Last reviewed | `2026-04-24` |
| When to update | this Stitch draft is re-generated, implemented, superseded, or rejected |

## Status

Reference only. Do not copy the generated Tailwind HTML directly into `apps/web`.

This draft explores a cleaner, more focused login/register experience. It is highly applicable because it does not require changing the global app shell, routing, data flow, local-first behavior, or sync boundaries.

## Source

Generated with Google Stitch.

Stored reference:

- [`2026-04-24-auth-clean-archive-card.html`](./2026-04-24-auth-clean-archive-card.html)

## Design Value

The draft is useful because it treats authentication as a quiet gateway into a personal archive rather than a marketing page. It centers a single card, uses a compact brand mark, keeps form fields readable, and avoids distracting side content.

Useful ideas:

- Centered auth card
- Compact archive/brand icon
- Clear page title and mode title
- One-column form
- Simple utility row for remember/password recovery if those features are implemented
- Full-width primary submit button
- Footer link that switches between login and register
- Very subtle archival background texture or surface mood

## Keep

- Centered single-card layout
- Brand mark above the form
- Quiet page title hierarchy
- Full-width primary action
- Footer link for login/register switching
- Strong input focus state using archive-blue accent
- Minimal decorative background only if it stays subtle
- Clean separation between form body and footer link

## Do Not Copy Directly

- Tailwind implementation
- Material Symbols dependency
- Inter / Work Sans font stack
- External background image URL
- English placeholders
- Remember-me checkbox unless it is backed by real product behavior
- Password recovery link unless that flow is implemented
- Any auth behavior change without backend/API support
- Any change to guest mode or local-first archive semantics

## Implementation Guidance

Rebuild selected ideas with the existing Work Archive UI system:

- Mantine
- `AuthPageTemplate`
- `AuthForm`
- `SectionCard`
- `SectionIntro`
- `AppButton`
- `FeedbackMessage`
- root `DESIGN.md` tokens

Keep:

- Current `/auth/login` and `/auth/register` routes
- Current Korean copy
- Current email/password auth behavior
- Current guest-mode links
- Current redirect behavior after auth
- Current accessible form labels and autocomplete values

## Suggested Implementation Scope

Auth screens only:

1. Simplify `AuthPageTemplate` into a more focused centered card layout.
2. Keep highlights only if they do not make the page feel busy.
3. Consider moving highlights below the card or removing them from the primary card.
4. Make the submit action full-width on auth forms.
5. Add a compact brand/icon area above the auth title.
6. Keep login/register/guest links in a clean footer region.
7. Do not add remember-me or password recovery unless real behavior exists.

## Recommended Codex Scope

```text
Use the Stitch auth reference to simplify LoginPage/RegisterPage presentation. Do not paste Tailwind HTML. Preserve Mantine, AuthPageTemplate, AuthForm behavior, Korean copy, guest-mode links, current email/password auth, and redirect logic. Improve centered card layout, brand mark, full-width submit, and footer link clarity. Do not add remember-me or password recovery without real functionality.
```

## Review Notes

This is the safest Stitch draft to implement. Unlike the home and works-list drafts, it does not imply global navigation changes. The main risk is adding UI controls that do not have real behavior, especially remember-me and password recovery. Keep the screen clean, honest, and behavior-backed.
