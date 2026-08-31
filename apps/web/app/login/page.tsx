import AuthForm from "@/components/AuthForm";
import { safeNextPath } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const query = await searchParams;
  return (
    <div className="auth-page auth-page-solo">
      <div className="wrap auth-solo-layout">
        <AuthForm nextPath={safeNextPath(query.next)} callbackError={query.error === "callback"} />
      </div>
    </div>
  );
}
