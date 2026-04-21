# SECURITY_HARDENING_ROADMAP.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `security roadmap` |
| Source of truth | current auth storage, API runtime config, Swagger/CORS behavior |
| Last verified against | `2026-04-21` working tree |
| When to update | 현재 보안 baseline, 공개 전 필수 항목, 단계별 완료 기준이 바뀔 때 |

이 문서는 Work Archive의 **실행 가능한 보안 강화 우선순위**를 정리한다. 현재 코드가 이미 안전하다고 선언하는 문서가 아니라, 공개 전/후/확장 전 해야 할 보안 작업을 관리하는 문서다.

## Goal

현재 개발용에 가까운 인증/운영 보안을, 공개 베타 전에는 서비스 운영이 가능한 최소선까지 끌어올리고 이후 단계적으로 강화한다.

## Current Baseline

현재 코드에서 확인되는 보안 현실:

- 비밀번호 해시 저장
- refresh token도 해시 저장
- access token / refresh token 분리
- 보호 API에 인증 가드 적용
- ValidationPipe 사용
- access/refresh token을 브라우저 `localStorage`에 저장
- refresh token이 `HttpOnly` cookie가 아님
- auth/sync rate limiting 없음
- CORS는 빈 값 또는 `*`에서 wildcard fallback 허용
- Swagger는 기본 활성화 상태

## Committed Now

공개 베타 전 필수 항목은 아래 다섯 가지로 고정한다.

1. refresh token cookie 전환
2. strict CORS whitelist
3. auth/sync rate limiting
4. 기본 보안 헤더
5. 운영 Swagger 제한

## Next

### Public Beta Prerequisites

- refresh token을 `HttpOnly + Secure + SameSite` cookie로 이동
- 프론트가 refresh token을 직접 읽지 않는 구조로 전환
- `CORS_ORIGIN` wildcard fallback 제거
- `/auth/login`, `/auth/register`, `/auth/refresh`, `/sync/push`, `/sync/pull`에 rate limit 적용
- `helmet` 등 기본 보안 헤더 적용
- 운영 환경에서 Swagger 비활성화 또는 제한

### Exit Checklist For This Phase

- [ ] refresh token이 JS에서 직접 읽히지 않는다
- [ ] 운영 환경에서 wildcard CORS가 열리지 않는다
- [ ] 인증/동기화 abuse가 무제한으로 가능하지 않다
- [ ] 운영 응답에 기본 보안 헤더가 포함된다
- [ ] 운영 공개 도메인에서 Swagger가 기본 노출되지 않는다

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

- 프론트 인증 저장 구조 변경
- 공개 전략과 배포 환경 분리
- public/catalog/community 구조 설계

## Exit Criteria

- 현재 보안 baseline과 목표 상태가 문서에서 혼동되지 않는다.
- 공개 전 필수 항목과 이후 강화 항목이 분리된다.
- 각 단계의 완료 조건을 체크리스트로 추적할 수 있다.
