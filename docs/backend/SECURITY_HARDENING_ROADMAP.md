# SECURITY_HARDENING_ROADMAP.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `security roadmap` |
| Source of truth | current auth storage, API runtime config, current Swagger/CORS/rate-limit behavior |
| Last verified against | `2026-04-22` working tree |
| When to update | 현재 보안 baseline, 남은 공개 전 backlog, 단계별 완료 기준이 바뀔 때 |

이 문서는 Work Archive의 **실행 가능한 보안 강화 우선순위**를 정리한다. 현재 코드가 이미 가진 baseline과 앞으로 남은 backlog를 분리해서 보여주는 문서다.

## Goal

현재 적용된 인증/운영 baseline을 유지한 채, 공개 전에는 남은 세션/운영 보안 과제를 정리하고 이후 단계적으로 강화한다.

## Current Baseline Already Applied

현재 코드에서 확인되는 보안 현실:

- 비밀번호 해시 저장
- refresh token 해시 저장
- access token / refresh token 분리
- 보호 API에 인증 가드 적용
- ValidationPipe 사용
- refresh token을 `HttpOnly` cookie로 저장
- 프론트는 access token만 `localStorage`에 저장
- `cookie-parser` 적용
- `helmet` 적용
- auth/sync rate limiting 적용
- CORS는 explicit whitelist만 허용
- Swagger는 `SWAGGER_ENABLED`로 제어

즉, 아래 항목은 더 이상 “계획만 있는 미래 작업”이 아니다.

- refresh token cookie 전환
- strict CORS whitelist
- auth/sync rate limiting
- 기본 보안 헤더
- 운영 Swagger 제한 토대

## Committed Now

공개 전까지 남은 보안 우선순위는 아래 네 가지로 정리한다.

1. access token 저장 구조와 세션 복구 UX 재검토
2. 배포 환경 기준 cookie / origin / secret 운영 검증
3. 로그아웃 / 세션 만료 / refresh 실패 시나리오 정합성 검증
4. 공개 확장 전 권한 및 공개 데이터 경계 준비

## Next

### Public Beta Backlog

- access token의 `localStorage` 저장 구조를 유지할지 대체할지 정책 확정
- refresh cookie + access token rotation failure path 검증
- production 환경에서 `COOKIE_SECURE`, `CORS_ORIGIN`, `SWAGGER_ENABLED` 설정 검증 절차 고정
- 로그아웃 / 세션 만료 / 만료된 refresh cookie 처리 E2E 확인
- 운영 secret 관리와 배포별 설정 분리 원칙 문서화

### Exit Checklist For This Phase

- [ ] access token 저장 구조에 대한 명시적 결정이 있다
- [ ] production 설정에서 cookie / origin / Swagger 노출 정책이 검증된다
- [ ] refresh 실패, 로그아웃, 세션 만료 시나리오가 문서와 실제 동작에서 어긋나지 않는다
- [ ] 공개 레이어 확장 전 필요한 권한/데이터 경계 과제가 식별돼 있다

## Later / Exploratory

### Post-Public

- 세션/디바이스 관리
- 보안 이벤트 로그
- 계정 보호 UX
- 백업/복구 정책

### Before Public Expansion

- 권한 모델 분리
- 공개/비공개 데이터 경계 강화
- submission / moderation abuse 방어
- 파일/이미지 업로드 보안

## Dependencies

- 프론트 인증 저장 구조 결정
- 공개 전략과 배포 환경 분리
- public/catalog/community 구조 설계

## Exit Criteria

- 현재 보안 baseline과 남은 backlog가 문서에서 혼동되지 않는다.
- 이미 적용된 항목을 미래 계획처럼 다시 읽지 않게 된다.
- 공개 전 필수 항목과 이후 강화 항목이 분리된다.
- 각 단계의 완료 조건을 체크리스트로 추적할 수 있다.
