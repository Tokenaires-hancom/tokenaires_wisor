"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage, type AuthMode } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type Props = {
  nextPath: string;
  callbackError?: boolean;
};

export default function AuthForm({ nextPath, callbackError = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    callbackError ? "로그인 확인에 실패했습니다. 다시 시도해 주세요." : "",
  );
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");

  function clientOrExplain() {
    const client = createClient();
    if (!client) {
      setMessageKind("error");
      setMessage("Supabase 환경변수가 설정되지 않았습니다. 운영 설정을 확인해 주세요.");
    }
    return client;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = clientOrExplain();
    if (!supabase) return;

    setBusy(true);
    setMessage("");
    const credentials = { email: email.trim(), password };

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      setBusy(false);
      if (error) {
        setMessageKind("error");
        setMessage(authErrorMessage(error.code));
        return;
      }
      router.push(nextPath);
      router.refresh();
      return;
    }

    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: callback.toString() },
    });
    setBusy(false);
    if (error) {
      setMessageKind("error");
      setMessage(authErrorMessage(error.code));
      return;
    }
    if (data.session) {
      router.push(nextPath);
      router.refresh();
      return;
    }
    setMessageKind("success");
    setMessage("확인 이메일을 보냈습니다. 이메일의 링크를 열면 가입이 완료됩니다.");
  }

  async function signInWithGoogle() {
    const supabase = clientOrExplain();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setBusy(false);
      setMessageKind("error");
      setMessage(authErrorMessage(error.code));
    }
  }

  async function sendResetEmail() {
    if (!email.trim()) {
      setMessageKind("error");
      setMessage("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.");
      return;
    }
    const supabase = clientOrExplain();
    if (!supabase) return;
    setBusy(true);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callback.toString(),
    });
    setBusy(false);
    setMessageKind(error ? "error" : "success");
    setMessage(
      error
        ? authErrorMessage(error.code)
        : "비밀번호 재설정 이메일을 보냈습니다. 받은 편지함을 확인해 주세요.",
    );
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist" aria-label="계정 방식">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => { setMode("signin"); setMessage(""); }}
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => { setMode("signup"); setMessage(""); }}
        >
          회원가입
        </button>
      </div>

      <div className="auth-panel-body">
        <p className="eyebrow">WISOR ACCOUNT</p>
        <h1 id="auth-title">{mode === "signin" ? "학습을 이어가세요" : "학습 기록을 묶어 두세요"}</h1>
        <p className="auth-intro">
          {mode === "signin"
            ? "Wisor 계정으로 본인을 확인하고 학습 화면으로 돌아갑니다."
            : "이메일을 확인하면 Wisor에서 사용할 계정이 만들어집니다."}
        </p>

        <button className="auth-google" type="button" disabled={busy} onClick={signInWithGoogle}>
          <span aria-hidden="true">G</span>
          Google로 계속하기
        </button>

        <div className="auth-divider"><span>또는 이메일로</span></div>

        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="auth-email">이메일</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <div className="auth-password-label">
            <label htmlFor="auth-password">비밀번호</label>
            {mode === "signin" && (
              <button type="button" onClick={sendResetEmail} disabled={busy}>비밀번호 재설정</button>
            )}
          </div>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상"
          />
          {message && <p className="auth-message" data-kind={messageKind} role="status">{message}</p>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "확인 중…" : mode === "signin" ? "이메일로 로그인" : "이메일로 가입"}
          </button>
        </form>
      </div>
    </section>
  );
}
