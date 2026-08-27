import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import PersonaChatFab from "@/components/PersonaChatFab";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisor — 기업을 고르는 법을 배우는 학습 서비스",
  description: "투자 대가의 판단 기준으로 종목을 살펴보고, 확인한 것을 학습노트에 기록하는 학습 서비스입니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
          <SiteFooter />
        </div>
        <Suspense fallback={null}>
          <PersonaChatFab />
        </Suspense>
      </body>
    </html>
  );
}
