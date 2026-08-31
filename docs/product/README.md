# docs/product/

| Field                 | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Status                | `active`                                                              |
| Role                  | `product authority navigation`                                        |
| Source of truth       | [`PRODUCT_CONSTITUTION.md`](./PRODUCT_CONSTITUTION.md)                |
| Last verified against | `2026-08-26` product-principle and Community scope audit              |
| When to update        | product authority, document disposition, or approval workflow changes |

이 폴더는 현재 제품 판단의 권한을 둔다. Work Archive의 유일한 제품 방향
기준은 [`PRODUCT_CONSTITUTION.md`](./PRODUCT_CONSTITUTION.md)다. 구현 상태,
실행 순서, 시각 규칙, 실험 계획은 이 문서를 구체화할 수 있지만 뒤집을 수 없다.

## Authority Order

1. [`PRODUCT_CONSTITUTION.md`](./PRODUCT_CONSTITUTION.md): 제품 목적, 데이터
   경계, 기능 계층, 확장 승인 규칙
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md): 현재 구현 현실
3. [`../project/EXECUTION_ROADMAP.md`](../project/EXECUTION_ROADMAP.md): 승인된 실행 순서
4. [`../design/PRODUCT_EXPERIENCE_DIRECTION.md`](../design/PRODUCT_EXPERIENCE_DIRECTION.md): 경험 원칙
5. [`../design/STUDIO_PHILOSOPHY.md`](../design/STUDIO_PHILOSOPHY.md): 시각 원칙

## Document Disposition

| Document                                    | Disposition            | Meaning                                        |
| ------------------------------------------- | ---------------------- | ---------------------------------------------- |
| `PRODUCT_CONSTITUTION.md`                   | 유지 / canonical       | 유일한 제품 방향 기준                          |
| `PRODUCT_EXPERIENCE_DIRECTION.md`           | 수정 / active          | 헌법을 화면 경험으로 구체화                    |
| `STUDIO_PHILOSOPHY.md`                      | 수정 / active          | 헌법을 시각 언어로 구체화                      |
| `EXECUTION_ROADMAP.md`                      | 수정 / active          | 승인된 범위의 실행 순서                        |
| `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`  | 유지 / canonical       | 제품 의도가 아니라 현재 구현 현실의 기준       |
| `COMMUNITY_ALPHA_PLAN.md`                   | 수정 / active          | 제한된 공개 감상 실험 계약; 확장 구현은 미승인 |
| `archive/product/PRODUCT_DIRECTION_LOCK.md` | 폐기하지 않고 archived | 2026-08-25까지의 역사 스냅샷; 현재 권한 없음   |

폐기는 출처를 지운다. 이번 정리는 과거 판단의 추적 가능성을 위해 상충 문서를
삭제하지 않고 archive에서 명확히 퇴역시킨다.
