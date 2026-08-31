import AuthForm from "@/components/AuthForm";
import { safeNextPath } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const query = await searchParams;
  return (
    <div className="auth-page">
      <div className="wrap auth-layout">
        <aside className="auth-ledger" aria-label="Wisor에서 남기는 기록">
          <p className="eyebrow">YOUR LEARNING LEDGER</p>
          <h2>고른 기준과<br />남긴 생각을<br />한곳에.</h2>
          <p>계정은 투자 판단을 대신하지 않습니다. 내가 확인한 과정으로 돌아오는 출입구입니다.</p>
          <dl>
            <div><dt>학습 진도</dt><dd>완료한 철학과 챕터</dd></div>
            <div><dt>확인 기록</dt><dd>퀴즈와 기록형 답</dd></div>
            <div><dt>관심 기업</dt><dd>관심종목과 학습노트</dd></div>
          </dl>
          <p className="auth-ledger-note">
            가입 전에 남긴 기록은 이 브라우저에 임시 보관됩니다. 로그인하거나 가입하면 계정 기록과 합쳐집니다.
          </p>
        </aside>
        <AuthForm nextPath={safeNextPath(query.next)} callbackError={query.error === "callback"} />
      </div>
    </div>
  );
}
