export const ACCOUNT_DELETE_CONFIRMATION = "계정 삭제";

export function hasValidDeleteConfirmation(value: unknown): boolean {
  return value === ACCOUNT_DELETE_CONFIRMATION;
}

export function isSameOrigin(origin: string | null, expectedOrigin: string): boolean {
  return origin === expectedOrigin;
}

/** 계정 삭제 요청을 받아들일 공개 주소. 스킴까지 포함한다.
 *
 * 이 값을 요청에서 유도하면 안 된다. 프록시 뒤에서 `request.nextUrl.origin`은
 * 스킴만 `X-Forwarded-Proto`를 따르고 호스트는 서버가 바인딩한 주소로 잡혀
 * `https://localhost:3000`이 된다. 브라우저가 보내는 `https://wisor.site`와
 * 절대 같아지지 않아 배포에서 계정 삭제가 전부 403이 된다. */
export function siteOrigin(configured: string | undefined): string {
  return configured || "http://localhost:3000";
}
