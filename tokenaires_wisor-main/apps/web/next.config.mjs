/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // 차트 분석 서비스 주소. 비전 LLM 키는 그쪽에만 있고 브라우저로 나오지 않는다.
    NEXT_PUBLIC_CHART_API: process.env.NEXT_PUBLIC_CHART_API ?? "http://localhost:8000",
  },
};
export default nextConfig;
