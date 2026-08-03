import MyLearning from "@/components/MyLearning";
import { companyNames } from "@/lib/scores";

/** 서버 컴포넌트. 재무데이터 전체가 아니라 티커→종목명 표만 클라이언트로 내려보낸다. */
export default function MyLearningPage() {
  return <MyLearning names={companyNames()} />;
}
