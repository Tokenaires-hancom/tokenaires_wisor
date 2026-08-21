export type AuthMode = "signin" | "signup";

export function relativeRedirect(path: string): Response {
  return new Response(null, {
    status: 307,
    headers: { Location: path },
  });
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/me";
  return value;
}

export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "이메일이나 비밀번호가 맞지 않습니다.";
    case "email_not_confirmed":
      return "받은 편지함에서 이메일 확인을 먼저 완료해 주세요.";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일입니다. 로그인해 주세요.";
    case "weak_password":
      return "비밀번호는 8자 이상으로 만들어 주세요.";
    case "over_email_send_rate_limit":
      return "이메일을 너무 자주 요청했습니다. 잠시 뒤 다시 시도해 주세요.";
    case "validation_failed":
      return "이메일 형식과 비밀번호를 다시 확인해 주세요.";
    default:
      return "인증을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  }
}
