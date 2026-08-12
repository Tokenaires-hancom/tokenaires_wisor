/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    // 대가 페이지 왼쪽 아래에 떠 있는 MobileMasterDock 버튼과 겹쳐서
    // 개발 중 클릭이 안 먹혔다. 개발 배지만 옮긴다 — 배포 빌드엔 없다.
    position: "bottom-right",
  },
};
export default nextConfig;
