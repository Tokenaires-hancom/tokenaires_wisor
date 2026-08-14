import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import PersonaChatFab from "@/components/PersonaChatFab";
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
          <footer className="foot">
            <div className="wrap">
              <p>
                Wisor는 학습 서비스입니다. 매수·매도 판단, 목표가, 미래 가격 전망을 제공하지
                않으며 최종 결정은 사용자가 합니다.
              </p>
              <p>
                투자 철학은 각 투자자가 공개한 원칙을 참고해 Wisor가 재구성한 것입니다. 해당
                투자자가 이 서비스에 참여하거나 이를 보증하지 않습니다.
              </p>
            </div>
          </footer>
        </div>
        <Suspense fallback={null}>
          <PersonaChatFab />
        </Suspense>
      </body>
    </html>
  );
}
