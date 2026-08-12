/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // 차트 분석 서비스 주소. 비전 LLM 키는 그쪽에만 있고 브라우저로 나오지 않는다.
    NEXT_PUBLIC_CHART_API: process.env.NEXT_PUBLIC_CHART_API ?? "http://localhost:8000",
  },
  devIndicators: {
    // 대가 페이지 왼쪽 아래에 떠 있는 MobileMasterDock 버튼과 겹쳐서
    // 개발 중 클릭이 안 먹혔다. 개발 배지만 옮긴다 — 배포 빌드엔 없다.
    position: "bottom-right",
  },
};
export default nextConfig;
