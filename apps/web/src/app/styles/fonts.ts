/**
 * 자체 호스팅 폰트 — 외부 CDN(jsdelivr·Google Fonts) 의존을 제거하고
 * 모든 글꼴을 앱 번들에 포함한다. 한글 글꼴은 unicode-range 동적 서브셋으로
 * 실제 렌더링되는 글리프 청크만 받아 온다.
 *
 * 패밀리 이름은 mantine-theme.ts 의 폰트 스택과 일치해야 한다.
 */

/* 본문·UI 한글 — Pretendard 가변(동적 서브셋) → "Pretendard Variable" */
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

/* 라틴 디스플레이 세리프 — Gloock 400 */
import '@fontsource/gloock/latin-400.css';

/* 라틴 에디토리얼 세리프 — Lora 400..600 + italic 400..500 */
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-500-italic.css';

/* 한글 명조(디스플레이·세리프 폴백) — Noto Serif KR 400/500/700 */
import '@fontsource/noto-serif-kr/korean-400.css';
import '@fontsource/noto-serif-kr/korean-500.css';
import '@fontsource/noto-serif-kr/korean-700.css';

/* 코드·수치 — JetBrains Mono 400/500/700 */
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
