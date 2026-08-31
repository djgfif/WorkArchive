import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Work Archive — 내 감상 기록 서재",
  description:
    "보고 읽은 모든 것을 브라우저에 먼저 기록하고 필요할 때 동기화하는 개인 미디어 아카이브.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Work Archive — 내 감상 기록 서재",
    description: "보고 읽은 모든 것을, 내 기록으로 남기는 서재",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Work Archive — 내 감상 기록 서재",
    description: "보고 읽은 모든 것을, 내 기록으로 남기는 서재",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
