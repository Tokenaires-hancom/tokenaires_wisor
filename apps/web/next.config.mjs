// 모든 경로에 붙이는 보안 헤더.
// CSP는 안전 부분집합만 둔다: 클릭재킹(frame-ancestors)·base-uri·object-src 차단은
// 렌더링을 깨지 않는다. script-src/style-src를 조이면 Next 하이드레이션이 깨질 수
// 있어, 배포 환경에서 브라우저로 확인한 뒤 별도로 추가해야 한다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds clear .next, so dev needs its own output directory when
  // another workspace session runs `npm run build` at the same time.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    const origin = process.env.PERSONA_API_ORIGIN || "http://127.0.0.1:8000";
    return [{ source: "/api/persona/:path*", destination: `${origin}/:path*` }];
  },
  devIndicators: {
    // 대가 페이지 왼쪽 아래에 떠 있는 MobileMasterDock 버튼과 겹쳐서
    // 개발 중 클릭이 안 먹혔다. 개발 배지만 옮긴다 — 배포 빌드엔 없다.
    position: "bottom-right",
  },
};
export default nextConfig;
