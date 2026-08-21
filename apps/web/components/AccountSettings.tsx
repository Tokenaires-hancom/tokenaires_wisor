"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/accountDeletion";
import { authErrorMessage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function AccountSettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("success");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendResetEmail() {
    if (!user?.email) return;
    const supabase = createClient();
    if (!supabase) {
      setMessageKind("error");
      setMessage("계정 연결 설정을 확인해 주세요.");
      return;
    }

    setBusy(true);
    setMessage("");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
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

  async function signOut() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    if (deleteConfirmation !== ACCOUNT_DELETE_CONFIRMATION) return;
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setBusy(false);
      setMessageKind("error");
      setMessage(result?.message ?? "계정을 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      return;
    }

    const supabase = createClient();
    if (supabase) await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
    router.refresh();
  }

  if (!ready) {
    return <p className="lede">계정 정보를 불러오는 중입니다…</p>;
  }

  if (!user) {
    return (
      <div className="account-empty">
        <div>
          <strong>로그인하면 계정 설정을 확인할 수 있습니다</strong>
          <p>지금 남기는 기록은 이 브라우저에 임시 저장되며, 로그인하면 계정 기록과 합쳐집니다.</p>
        </div>
        <Link href="/login?next=%2Fme%23account-settings" className="btn">
          로그인
        </Link>
      </div>
    );
  }

  const provider = user.app_metadata.provider === "google" ? "Google" : "이메일";

  return (
    <div className="account-settings-card">
      <dl className="account-settings-facts">
        <div>
          <dt>이메일</dt>
          <dd>{user.email ?? "확인할 수 없음"}</dd>
        </div>
        <div>
          <dt>로그인 방식</dt>
          <dd>{provider}</dd>
        </div>
      </dl>
      <div className="account-settings-actions">
        <button type="button" className="btn" disabled={busy || !user.email} onClick={sendResetEmail}>
          비밀번호 재설정
        </button>
        <button type="button" className="btn" data-variant="quiet" disabled={busy} onClick={signOut}>
          로그아웃
        </button>
      </div>
      {message && <p className="auth-message" data-kind={messageKind} role="status">{message}</p>}
      <p className="account-storage-note">
        학습 기록과 관심 종목은 이 계정에 저장되며, 같은 계정으로 로그인한 다른 기기에서도 이어집니다.
      </p>
      <div className="account-danger-zone">
        <div>
          <strong>계정 삭제</strong>
          <p>
            계정과 계정에 저장된 학습 기록·관심 종목·노트는 함께 영구 삭제됩니다.
          </p>
        </div>
        {!deleteOpen ? (
          <button
            type="button"
            className="account-delete-trigger"
            disabled={busy}
            onClick={() => { setDeleteOpen(true); setMessage(""); }}
          >
            계정 삭제
          </button>
        ) : (
          <div className="account-delete-confirmation">
            <label htmlFor="account-delete-confirmation">
              계속하려면 <strong>{ACCOUNT_DELETE_CONFIRMATION}</strong>를 입력하세요
            </label>
            <input
              id="account-delete-confirmation"
              type="text"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
            <div>
              <button
                type="button"
                className="account-delete-submit"
                disabled={busy || deleteConfirmation !== ACCOUNT_DELETE_CONFIRMATION}
                onClick={deleteAccount}
              >
                {busy ? "삭제 중…" : "영구 삭제"}
              </button>
              <button
                type="button"
                className="account-delete-cancel"
                disabled={busy}
                onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); setMessage(""); }}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
