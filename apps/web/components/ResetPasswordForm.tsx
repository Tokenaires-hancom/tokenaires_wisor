"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(authErrorMessage(error.code));
      return;
    }
    router.push("/me");
    router.refresh();
  }

  return (
    <form className="auth-panel auth-reset" onSubmit={submit}>
      <div className="auth-panel-body">
        <p className="eyebrow">NEW PASSWORD</p>
        <h1>새 비밀번호를 정하세요</h1>
        <p className="auth-intro">다른 곳에서 쓰지 않는 8자 이상의 비밀번호를 권합니다.</p>
        <label htmlFor="new-password">새 비밀번호</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {message && <p className="auth-message" data-kind="error" role="alert">{message}</p>}
        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? "저장 중…" : "비밀번호 저장"}
        </button>
      </div>
    </form>
  );
}
