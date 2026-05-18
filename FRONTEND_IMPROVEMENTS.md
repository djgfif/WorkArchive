# 프론트엔드 개선 내역

> 작성일: 2026-05-18  
> 대상: `apps/web` — React 19 + Mantine 7 + TypeScript

---

## 개선 개요

총 **7개 파일**을 수정하여 디자인 일관성, 라이트/다크 모드 지원, 인터페이스 밀도, 유저 편의성을 전면 개선하였습니다.

---

## 수정 파일 목록

| 파일 | 주요 변경 내용 |
|---|---|
| `src/app/mantine-theme.ts` | 아카이브 블루 팔레트 교체, 라이트/다크 CSS 변수 완전 분리, 컴포넌트 기본값 정비 |
| `src/app/styles/global.css` | 라이트 모드 배경 그라디언트 추가, sticky 헤더, 커스텀 스크롤바, 포커스 스타일 강화 |
| `src/app/layouts/MainProductLayout.tsx` | 브랜드 아이콘 추가, 계정 드롭다운 메뉴, 모바일 Drawer 계정 섹션 통합 |
| `src/shared/components/AppPrimitives.tsx` | `BrandLink` 아이콘 ThemeIcon 추가, `AppNavLink` 활성 상태 하단 밑줄, `LoadingRows` 스켈레톤 개선 |
| `src/features/works/components/WorksToolbar.tsx` | 상태 필터 상시 노출, 활성 필터 chip 표시, 고급 필터 토글 배지 카운트 |
| `src/features/works/components/WorkListRow.tsx` | 인라인 컨트롤 밀도 감소, "빠른 수정" Collapse 패널로 분리, 상태 배지 색상 의미화 |
| `src/features/works/components/ArchiveComponents.tsx` | `ArchiveHero` eyebrow 스타일 강화, `ArchiveStarterShelf` eyebrow 추가 |
| `src/features/works/components/ArchiveComponents.module.css` | 라이트 모드 hero/poster/card 배경 추가, 필터 pill 호버·활성 상태 개선, listRow 호버 효과 |
| `src/features/home/pages/HomePage.tsx` | 히어로 제목 "내 아카이브"로 개선, 통계 카드 상단 배치, QuickStat 컴포넌트 추가 |

---

## 주요 개선 사항 상세

### 1. 테마 색상 정렬 (mantine-theme.ts)

**이전:** 보라-퍼플 계열 `archiveColors` (DESIGN.md와 불일치)  
**이후:** 블루-그레이 계열 아카이브 팔레트로 교체, `ember` 색상(황금)은 별점·따뜻한 강조에 유지

```
#eef5fb → #253b55  (9단계 블루-그레이 팔레트)
```

라이트/다크 모드 CSS 변수를 `cssVariablesResolver`에서 완전히 분리하여 모드 전환 시 색상 깨짐 현상 해소.

---

### 2. 헤더 / 네비게이션 (MainProductLayout.tsx)

- **브랜드 로고**: 텍스트 전용 → `ThemeIcon` + "WA" 이니셜 아이콘 + 키커/헤딩 2행 구조
- **계정 메뉴 (데스크탑)**: 아바타 이니셜 버튼 → `Menu` 드롭다운 (계정 개요, 설정, 테마 전환, 로그인/로그아웃)
- **모바일 Drawer**: 계정 상태 배지, 테마 전환, 로그인/로그아웃 버튼 통합
- **Sticky 헤더**: `position: sticky; backdrop-filter: blur(8px)` 적용

---

### 3. 작품 목록 툴바 (WorksToolbar.tsx)

- **상태 필터 상시 노출**: 기존 Collapse 내부 → 히어로 아래 항상 표시
- **활성 필터 chip**: 적용된 필터를 태그로 표시, 개별 제거 가능
- **고급 필터 토글 배지**: 활성 필터 수를 버튼 옆 배지로 표시
- **고급 필터 패널**: 유형·정렬·별점·태그를 2열 그리드로 정리

---

### 4. 작품 리스트 행 (WorkListRow.tsx)

**이전:** 한 행에 별점 select, 상태 select, 진행도 3개 입력이 모두 노출 → 밀도 과부하  
**이후:** 기본 상태에서는 배지 요약만 표시, "빠른 수정 ↓" 버튼으로 Collapse 패널 열기

- 상태 배지에 의미적 색상 적용 (완료=teal, 진행중=archive, 드롭=red)
- 즐겨찾기 배지 인라인 표시
- 삭제 버튼 레이블 "삭제" → "휴지통으로 이동"으로 명확화

---

### 5. 홈 페이지 (HomePage.tsx)

- **히어로 제목**: "기록 홈" → "내 아카이브" (직관성 향상)
- **통계 카드 위치**: 하단 → 콘텐츠 최상단 (데이터 있을 때만 표시)
- **QuickStat 컴포넌트**: ThemeIcon + 레이블 + 값 카드 형태로 시각화
- **섹션 eyebrow**: "이어보기", "최근 활동" 등 컬러 eyebrow 텍스트 추가

---

### 6. CSS 개선 (ArchiveComponents.module.css, global.css)

- **라이트 모드 hero 배경**: 다크 배경 → 밝은 블루-그레이 그라디언트
- **poster 라이트 모드**: 어두운 배경 → 밝은 회청색 팔레트
- **filterPill 호버/활성**: `color-mix()` 기반 반투명 강조색 사용
- **listRow 호버**: 배경색 전환 + 테두리 강조
- **커스텀 스크롤바**: 6px 얇은 스크롤바, 테마 색상 연동

---

## 타입 체크 결과

```
TypeScript tsc --noEmit: 오류 없음 ✓
```

---

## 개발 서버 실행 방법

```bash
# 루트에서
npm run dev:web

# 또는
cd apps/web && npx vite
```
