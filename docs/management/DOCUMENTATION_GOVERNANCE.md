# DOCUMENTATION_GOVERNANCE.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `governance` |
| Source of truth | 문서 운영 규칙과 현재 폴더 구조 |
| Last verified against | `2026-04-21` working tree |
| When to update | 문서 생성/이동/metadata/archive 규칙이 바뀔 때 |

이 문서는 Work Archive 저장소의 문서를 어떻게 만들고, 어디에 두고, 어떤 상태로 해석할지 정하는 운영 규칙이다.

## 1. Core Rules

1. 문서는 역할이 겹치지 않게 만든다.
2. 루트에는 실행/운영 문서만 두고 설계/로드맵 문서는 `docs/` 아래에 둔다.
3. 현재 상태와 목표 구조와 역사 문맥을 명확히 분리한다.
4. 새 문서를 만들기 전에 기존 문서 확장으로 해결 가능한지 먼저 확인한다.
5. 문서 이동과 이름 변경은 index, matrix, 관련 README 갱신과 함께 처리한다.

## 2. Required Metadata

주요 문서 상단에는 아래 metadata를 둔다.

- `Status`
- `Role`
- `Source of truth`
- `Last verified against`
- `When to update`

이 metadata는 문서를 읽기 전에 해석 방식을 먼저 알려주는 역할을 한다.

## 3. Status Definitions

- `canonical`: 현재 따라야 하는 기준 문서
- `active`: 자주 참고하는 문서
- `reference`: 역사 문맥 보존 문서
- `archived`: 현재 기준에서 내려간 문서

## 4. Folder Responsibilities

- `docs/project`: 현재 상태와 historical reference
- `docs/frontend`: 현재 프론트 기준과 프론트 구조/실행 계획
- `docs/backend`: 백엔드 목표 구조와 보안 로드맵
- `docs/product`: 제품 비전, near-term 로드맵, 확장 전략
- `docs/management`: 해석 규칙과 상태 관리
- `docs/archive`: 명확히 내려간 문서

## 5. How To Add Or Change Documents

문서를 만들거나 크게 바꾸기 전에 아래를 확인한다.

1. 기존 문서 섹션 추가로 해결 가능한가
2. 이 문서는 `current reality`, `target structure`, `target roadmap`, `historical reference` 중 무엇인가
3. 어느 폴더에 들어가야 하는가
4. status는 무엇인가
5. 어떤 기존 문서와 링크/역할 관계를 맺는가

## 6. Mandatory Follow-Up Updates

다음 작업을 하면 함께 갱신한다.

- 문서 생성/이동/이름 변경: [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md), [`DOCUMENT_STATUS_MATRIX.md`](./DOCUMENT_STATUS_MATRIX.md), 관련 폴더 `README.md`
- 기준 문서 역할 변경: 필요 시 [`CODE_DOCUMENT_ALIGNMENT_REPORT.md`](./CODE_DOCUMENT_ALIGNMENT_REPORT.md)
- archive 이동: [`../archive/README.md`](../archive/README.md) 기준 확인

## 7. Reference And Archive Rules

- reference 문서는 현재 코드 기준으로 읽지 않도록 파일 내부에서 직접 경고한다.
- archive는 대체 기준 문서가 명확하고 재참조 가치가 낮을 때만 사용한다.
- reference라고 해서 자동으로 archive로 보내지 않는다.

## 8. Practical Rule

문서를 줄이는 것보다, **어떤 문서가 무엇을 책임지는지 먼저 분명히 한다.**
