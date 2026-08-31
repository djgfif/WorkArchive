# Product Experience Direction

| Field                 | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Status                | `active`                                                                |
| Role                  | `product-experience guidance`                                           |
| Source of truth       | [`PRODUCT_CONSTITUTION.md`](../product/PRODUCT_CONSTITUTION.md)         |
| Last verified against | `2026-08-26` product-principle and navigation audit                     |
| When to update        | core archive loop, information hierarchy, or interaction policy changes |

이 문서는 제품 헌법을 화면 경험으로 구체화한다. 시각 구현은
[`Studio`](./STUDIO_PHILOSOPHY.md)를 따르며, 범위가 충돌하면 제품 헌법이 우선한다.

## Product Promise

Work Archive는 개인 미디어 역사를 빠르게 기록하고 다시 발견하는 private,
local-first 아카이브다. 계정 sync, import, 검색 provider는 아카이브를 확장하지만
시작과 유지의 전제 조건이 될 수 없다.

Community는 기본 제품 경험이나 소셜 feed가 아니다. 승인된 공개 감상 알파는
개인 아카이브와 분리된 opt-in plane이며, profile, follow, comment, ranking,
recommendation mechanics는 별도 승인 전까지 실험 범위다.

## Primary Experience

첫 사용 루프는 `capture-first, enrich-later`다.

1. Home이나 추가 화면에서 제목을 입력하거나 검색 보조를 사용한다.
2. 매체 유형과 저장 위치를 확인하고 즉시 local save한다.
3. 상태, 별점, 메모, 표지와 메타데이터는 필요할 때 보강한다.
4. 저장 결과와 backup 경로를 분명히 보여 준다.

Home은 analytics dashboard보다 archive desk에 가깝다. 빠른 기록과 최근
개인 기록이 먼저 오며, 통계는 의미 있는 신호가 있을 때 점진적으로 열린다.

## Progressive Disclosure

- 제목, 매체 유형, primary action, 저장 위치와 data-safety 상태는 보이게 둔다.
- 선택 메타데이터와 기술 설정은 명확한 disclosure 아래 둔다.
- 데이터 손실, 공개, 삭제, sync conflict에는 위험에 비례한 의도적 마찰을 둔다.
- 일반 안내를 위험 경고처럼 과장하지 않는다.
- 큰 아카이브에서는 검색·정렬·필터를, 작은 아카이브에서는 다음 유용한 행동을 우선한다.
- desktop과 mobile의 표현은 달라도 핵심 능력의 도달 가능성은 같아야 한다.

Progressive disclosure는 표현만 바꾼다. 기존 능력이나 local-first 저장 의미를
없애지 않는다.

## Low-data Behavior

고정된 작품 수만으로 화면을 잠그지 않는다.

- 기록이 없으면 직접 입력, 검색 보조, import/restore의 안전한 시작 경로를 가르친다.
- 기록이 적으면 빈 chart 대신 최근 기록과 다음 행동을 보여 준다.
- 충분한 timeline, rating, completion 신호가 생긴 insight만 설명과 함께 연다.
- 신뢰할 수 없는 표본은 숨기기보다 한계와 산출 근거를 알린다.

## Product Review Checklist

- guest가 network 없이 최소 기록을 저장할 수 있는가?
- desktop과 mobile에서 핵심 행동이 첫 화면 또는 명확한 한 단계 안에 있는가?
- 데이터 변경 전에 저장 plane과 영향을 이해할 수 있는가?
- 공개 전 실제 공개 필드와 회수 한계를 보여 주는가?
- backup, recovery, conflict resolution이 Home 또는 Settings에서 도달 가능한가?
- Community나 파생 도구가 개인 아카이브의 정보 구조를 지배하지 않는가?
- Korean-first, accessibility, Studio의 의미론적 상태 표현이 유지되는가?
