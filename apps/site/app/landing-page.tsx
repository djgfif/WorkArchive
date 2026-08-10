'use client';

import { useState } from 'react';

type DemoView = 'home' | 'archive' | 'insights';

const demoViews: Array<{ id: DemoView; label: string }> = [
  { id: 'home', label: '홈' },
  { id: 'archive', label: '기록 목록' },
  { id: 'insights', label: '인사이트' },
];

const sampleWorks = [
  {
    accent: 'indigo',
    author: '서하진',
    progress: '18 / 24화',
    rating: '4.5',
    status: '감상 중',
    title: '겨울 궤도',
    type: '애니',
  },
  {
    accent: 'slate',
    author: '윤해원',
    progress: '완독',
    rating: '4.0',
    status: '완료',
    title: '유리 정원',
    type: '소설',
  },
  {
    accent: 'violet',
    author: '문도윤',
    progress: '42 / 80화',
    rating: '4.2',
    status: '감상 중',
    title: '밤의 지도',
    type: '웹툰',
  },
];

function Poster({ accent, title }: { accent: string; title: string }) {
  return (
    <div aria-hidden="true" className={`poster poster--${accent}`}>
      <span>WA</span>
      <strong>{title}</strong>
    </div>
  );
}

function HomePreview() {
  return (
    <div className="demo-panel" role="tabpanel">
      <div className="demo-heading">
        <div>
          <span className="eyebrow">TODAY</span>
          <h3>다시 이어볼 기록</h3>
        </div>
        <span className="demo-date">08 · 10</span>
      </div>
      <div className="metric-row">
        <div>
          <strong>18</strong>
          <span>전체 기록</span>
        </div>
        <div>
          <strong>7</strong>
          <span>감상 중</span>
        </div>
        <div>
          <strong>4.2</strong>
          <span>평균 평점</span>
        </div>
      </div>
      <div className="shelf" aria-label="샘플 작품 선반">
        {sampleWorks.map((work) => (
          <article className="shelf-item" key={work.title}>
            <Poster accent={work.accent} title={work.title} />
            <div>
              <strong>{work.title}</strong>
              <span>{work.progress}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArchivePreview() {
  return (
    <div className="demo-panel" role="tabpanel">
      <div className="demo-heading">
        <div>
          <span className="eyebrow">ARCHIVE</span>
          <h3>내 기록 18개</h3>
        </div>
        <span className="filter-chip">최근 수정순</span>
      </div>
      <div className="archive-list">
        {sampleWorks.map((work) => (
          <article className="archive-row" key={work.title}>
            <Poster accent={work.accent} title={work.title} />
            <div className="archive-copy">
              <span>
                {work.type} · {work.status}
              </span>
              <strong>{work.title}</strong>
              <small>
                {work.author} · {work.progress}
              </small>
            </div>
            <span className="rating" aria-label={`평점 ${work.rating}`}>
              ★ {work.rating}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

function InsightsPreview() {
  return (
    <div className="demo-panel" role="tabpanel">
      <div className="demo-heading">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h3>기록이 보여주는 취향</h3>
        </div>
        <span className="demo-date">최근 28일</span>
      </div>
      <div className="insight-grid">
        <article className="insight-card insight-card--wide">
          <span>기록 리듬</span>
          <div className="activity-bars" aria-label="주간 활동 12회">
            {[36, 64, 42, 78, 54, 92, 68].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <strong>이번 달 12회 기록</strong>
        </article>
        <article className="insight-card">
          <span>가장 많이 본 유형</span>
          <strong>소설</strong>
          <small>전체 기록의 39%</small>
        </article>
        <article className="insight-card">
          <span>자주 남긴 태그</span>
          <strong>성장 · 미스터리</strong>
          <small>취향 단서 8개</small>
        </article>
      </div>
    </div>
  );
}

export function LandingPage({ appPocUrl }: { appPocUrl: string | null }) {
  const [activeView, setActiveView] = useState<DemoView>('home');

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Work Archive 홈">
          <span className="brand-mark" aria-hidden="true">
            WA
          </span>
          <span>Work Archive</span>
        </a>
        <nav aria-label="소개 페이지 탐색">
          <a href="#preview">제품 미리보기</a>
          <a href="#principles">기록 원칙</a>
          <a className="nav-cta" href="#try">
            직접 시험하기
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="hero-kicker">
            <i /> LOCAL-FIRST MEDIA ARCHIVE
          </span>
          <h1>
            보고 읽은 모든 것을,
            <br />
            <em aria-label="내 기록으로 남기는 서재">
              <span aria-hidden="true">내 기록으로</span>
              <span aria-hidden="true">남기는 서재</span>
            </em>
          </h1>
          <p>
            소설부터 애니까지 흩어진 감상 기록을 한곳에 모으세요. 기록은
            브라우저에 먼저 저장되고, 계정 동기화는 필요할 때 선택합니다.
          </p>
          <div className="hero-actions">
            <a className="button button--primary" href="#preview">
              제품 둘러보기 <span aria-hidden="true">↓</span>
            </a>
            {appPocUrl ? (
              <a className="button button--secondary" href={appPocUrl}>
                내 브라우저에서 직접 시험하기 <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span aria-disabled="true" className="button button--disabled">
                앱 POC 준비 중
              </span>
            )}
          </div>
          <div className="trust-row" aria-label="제품 원칙">
            <span>
              <i /> 브라우저 우선 저장
            </span>
            <span>
              <i /> 선택적 계정 동기화
            </span>
            <span>
              <i /> 내보낼 수 있는 기록
            </span>
          </div>
        </div>
        <div className="hero-object" aria-hidden="true">
          <div className="index-card index-card--back">
            <span>07</span>
          </div>
          <div className="index-card index-card--middle">
            <span>12</span>
          </div>
          <div className="index-card index-card--front">
            <div className="index-top">
              <span>PERSONAL ARCHIVE</span>
              <b>018</b>
            </div>
            <div className="index-title">
              WINTER
              <br />
              ORBIT
            </div>
            <div className="index-meta">
              <span>ANIMATION</span>
              <span>18 / 24</span>
            </div>
            <div className="index-progress">
              <i />
            </div>
          </div>
        </div>
      </section>

      <section className="preview-section" id="preview">
        <div className="section-intro">
          <span className="eyebrow">PRODUCT PREVIEW</span>
          <h2>기록이 쌓일수록 더 선명해지는 화면</h2>
          <p>
            아래 데모는 가상 작품과 샘플 데이터만 사용합니다. 탭을 눌러 주요
            화면을 둘러보세요.
          </p>
        </div>
        <div className="product-window">
          <div className="window-bar">
            <div className="window-brand">
              <span className="brand-mark">WA</span>
              <b>Work Archive</b>
            </div>
            <div className="window-actions">
              <span>⌘K</span>
              <i />
            </div>
          </div>
          <div className="demo-tabs" role="tablist" aria-label="제품 화면 선택">
            {demoViews.map((view) => (
              <button
                aria-selected={activeView === view.id}
                key={view.id}
                onClick={() => setActiveView(view.id)}
                role="tab"
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>
          {activeView === 'home' && <HomePreview />}
          {activeView === 'archive' && <ArchivePreview />}
          {activeView === 'insights' && <InsightsPreview />}
        </div>
      </section>

      <section className="principles" id="principles">
        <div className="section-intro">
          <span className="eyebrow">DESIGNED FOR OWNERSHIP</span>
          <h2>오래 남길 기록에 필요한 세 가지 원칙</h2>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>기기에 먼저</h3>
            <p>
              로그인 전에도 기록을 시작하고, IndexedDB에 로컬 원본을 보관합니다.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>동기화는 선택</h3>
            <p>
              계정이 필요할 때만 연결합니다. 로컬 기록과 계정 아카이브의 경계가
              분명합니다.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>언제든 내보내기</h3>
            <p>
              JSON과 CSV 백업으로 기록을 확인하고 다른 곳으로 옮길 수 있습니다.
            </p>
          </article>
        </div>
      </section>

      <section className="feature-strip" aria-label="핵심 기능">
        {[
          ['RECORD', '진행도와 평점'],
          ['TIMELINE', '변화를 남기는 타임라인'],
          ['INSIGHT', '기록으로 읽는 취향'],
          ['TIER', '나만의 티어보드'],
        ].map(([code, label]) => (
          <div key={code}>
            <span>{code}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </section>

      <section className="try-section" id="try">
        <span className="eyebrow">PRIVATE PREVIEW</span>
        <h2>내 기록으로 직접 시험해 보세요.</h2>
        <p>
          비공개 POC의 데이터는 해당 브라우저에만 저장되며 로그인·동기화·외부
          검색은 제공되지 않습니다.
        </p>
        {appPocUrl ? (
          <a className="button button--primary" href={appPocUrl}>
            게스트 앱 POC 열기 <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span aria-disabled="true" className="button button--disabled">
            앱 POC 준비 중
          </span>
        )}
      </section>

      <footer>
        <span>Work Archive</span>
        <span>개인 기록을 위한 조용한 작업실</span>
      </footer>
    </main>
  );
}
