/**
 * 자체 호스팅 폰트 — 외부 CDN(jsdelivr·Google Fonts) 의존을 제거하고
 * 모든 글꼴을 앱 번들에 포함한다. 한글 글꼴은 unicode-range 동적 서브셋으로
 * 실제 렌더링되는 글리프 청크만 받아 온다.
 *
 * 패밀리 이름은 mantine-theme.ts 의 폰트 스택과 일치해야 한다.
 */

/* 본문·UI·디스플레이 한글/라틴 — Pretendard 가변(동적 서브셋) → "Pretendard Variable"
   v6 "Studio"에서 본문·제목을 모두 Pretendard 산세리프로 통일하므로
   에디토리얼 세리프(Gloock/Lora/Noto Serif KR)는 더 이상 로드하지 않는다. */
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

/* 코드·수치 — JetBrains Mono 400/500/700 */
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
