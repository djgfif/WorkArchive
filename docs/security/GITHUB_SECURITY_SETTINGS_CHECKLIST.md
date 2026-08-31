# GitHub Security Settings Checklist

Gate 1 블로커 항목. 아래 설정은 코드가 아닌 **GitHub 웹 UI**에서 활성화해야 한다.
각 항목을 완료하면 `PUBLIC_BETA_GATE_1_EVIDENCE.md`의 GitHub Controls 섹션에 결과를 기록한다.

마지막 검토: 2026-08-31 — `master` 보호와 필수 검사는 GitHub API로 적용·확인했으며, 나머지 Security 설정은 운영자 확인이 필요하다.

---

## 1. Branch Protection (master)

**경로:** `Settings > Branches > Add branch ruleset` 또는 `Branch protection rules`

| 항목 | 권장값 |
|------|--------|
| Require a pull request before merging | ✓ |
| Required approving reviews | 1 이상 (솔로 개발이면 0 허용, 명시적 waiver 기록) |
| Require status checks to pass | ✓ |
| Required status checks | `verify`, `integration`, `CodeQL` |
| Require branches to be up to date | ✓ |
| Do not allow bypassing the above settings | ✓ |

완료 후 Evidence 기록:
```
- Branch protection enabled for `master`: ENABLED — required checks: verify, integration, CodeQL
```

---

## 2. CodeQL (코드 취약점 분석)

**저장소 상태:** `.github/workflows/codeql.yml` 존재 ✓  
- push/PR/매주 월요일 03:24 UTC 실행
- javascript-typescript 분석

**확인 경로:** `Security > Code scanning alerts`

체크리스트:
- [ ] 최근 CodeQL 실행 결과 확인 — alert 없거나 모두 dismissed/resolved
- [ ] `Settings > Code security > Code scanning` 에서 활성화 상태 확인

완료 후 Evidence 기록:
```
- CodeQL result: PASS — N alerts, all reviewed (날짜)
```

---

## 3. Dependabot

**저장소 상태:** `.github/dependabot.yml` 존재 ✓  
- npm 패키지: 매주 월요일 09:00 KST
- github-actions: 매주 월요일 09:30 KST

**활성화 경로:** `Settings > Code security > Dependabot`

| 항목 | 활성화 |
|------|--------|
| Dependabot alerts | ✓ 활성화 |
| Dependabot security updates | ✓ 활성화 권장 |
| Dependabot version updates | `.github/dependabot.yml`이 있으면 자동 |

**확인:** `Security > Dependabot alerts` — 미해결 critical/high alert 없는지 확인.
릴리스 후보는 별도로 `npm run security:audit:prod:high`가 PASS이거나
high or critical 프로덕션 런타임 취약점에 대한 만료일 있는 waiver가
`PUBLIC_BETA_GATE_1_EVIDENCE.md`에 기록되어야 한다.

완료 후 Evidence 기록:
```
- Dependabot enabled: ENABLED — N open alerts (all reviewed)
- Production npm audit high/critical gate: PASS — 0 high or critical production runtime findings
- Vulnerability waivers: none
```

---

## 4. Secret Scanning

**활성화 경로:** `Settings > Code security > Secret scanning`

| 항목 | 활성화 |
|------|--------|
| Secret scanning | ✓ 활성화 |
| Push protection | ✓ 활성화 (커밋 시 시크릿 차단) |
| Validity checks | 선택 (외부 API 시크릿 유효성 자동 검사) |

**확인:** `Security > Secret scanning alerts` — alert 없거나 모두 검토됨

완료 후 Evidence 기록:
```
- Secret scanning enabled: ENABLED
- Push protection enabled: ENABLED
```

---

## 5. 전체 확인 순서 (한 번에 처리)

```
1. github.com/<owner>/WorkArchive/settings/security_analysis
   → Dependabot alerts: Enable
   → Dependabot security updates: Enable
   → Secret scanning: Enable
   → Push protection: Enable

2. github.com/<owner>/WorkArchive/settings/branches
   → Add rule for `master`
   → Require status checks: verify, integration, CodeQL

3. github.com/<owner>/WorkArchive/security/code-scanning
   → 최근 실행 확인, alert 검토

4. github.com/<owner>/WorkArchive/security/dependabot
   → open alert 목록 확인

5. github.com/<owner>/WorkArchive/security/secret-scanning
   → alert 없음 확인
```

---

## 완료 후 Evidence 전체 템플릿

`PUBLIC_BETA_GATE_1_EVIDENCE.md` GitHub Controls 섹션에 아래 형식으로 기록:

```markdown
- Branch protection enabled for `master`: ENABLED — required checks: verify, integration, CodeQL, 1 approving review (or waived: solo project)
- Required checks: verify, integration, CodeQL
- CodeQL result: PASS — 0 open alerts as of YYYY-MM-DD
- Dependabot enabled: ENABLED — N open alerts, all reviewed
- Secret scanning enabled: ENABLED
- Push protection enabled: ENABLED
- Waivers: (없으면 none)
```
