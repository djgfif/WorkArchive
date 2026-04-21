# IMPLEMENT.md

| Field | Value |
| --- | --- |
| Status | `reference` |
| Role | `historical reference` |
| Source of truth | 초기 구현 지시 문맥 |
| Last verified against | legacy planning document preserved on `2026-04-21` |
| When to update | 기본적으로 갱신하지 않음. 역사 문맥 설명이 필요할 때만 상단 metadata 조정 |

> 이 문서는 historical reference다. 현재 코드 기준으로 읽지 말고, 초기 구현 지시와 제약을 추적할 때만 사용한다.

You are implementing the repository according to [PLAN.md](./PLAN.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Core Rules
1. [PLAN.md](./PLAN.md) is the source of truth.
2. Work on exactly one milestone at a time.
3. Do not expand scope beyond the current milestone.
4. Keep diffs minimal and well-structured.
5. After each milestone, run all listed validation commands.
6. If validation fails, fix the issues before stopping.
7. Update README when setup or commands change.
8. Prefer clarity and maintainability over clever abstractions.
9. Preserve local-first architecture decisions.
10. Do not replace the chosen stack unless the plan explicitly allows it.

## Architecture Rules
- Frontend must remain React + TypeScript + Vite.
- Frontend data layer must use IndexedDB via Dexie.
- Backend must remain NestJS + Prisma + PostgreSQL.
- PostgreSQL must run locally via Docker Compose.
- Shared types should live in packages/shared-types.
- The app must be usable offline for core CRUD in milestone 1.
- Sync must be queue-based and manual before automatic.
- Authentication is milestone 4, not earlier.
- Do not introduce Firebase, Supabase, or third-party backend services.

## Coding Rules
- Use TypeScript everywhere.
- Use feature/domain-driven folder structure.
- Write DTOs for API payloads.
- Use validation for incoming requests.
- Use soft delete instead of hard delete for works.
- Prefer repository/service separation.
- Add tests for all non-trivial logic.
- Avoid global mutable state unless justified.
- Do not add dead code or placeholder files without purpose.

## UI Rules
- Keep UI simple and clean.
- Make forms accessible.
- Show loading, empty, and error states.
- Show sync status clearly.
- Do not over-design styling in early milestones.

## Data Rules
Every work record should support:
- id
- type
- title
- author
- genres
- description
- thumbnailUrl
- status
- rating
- shortReview
- review
- tier
- favorite
- createdAt
- updatedAt
- deletedAt
- syncStatus
- serverVersion

## Sync Rules
- Local writes happen first.
- Queue sync events after local writes.
- Push and pull are separate operations.
- Start with Last Write Wins.
- Keep tombstones for deleted records.
- Log sync conflicts for inspection.

## Documentation Rules
Whenever a command, environment variable, or setup step changes:
- update [README.md](../../README.md)
- update relevant examples
- keep setup reproducible

## Stop Conditions
Stop after completing the current milestone and provide:
1. Summary of changed files
2. Validation results
3. Remaining risks
4. Suggested next prompt for the next milestone
