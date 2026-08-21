export const ACCOUNT_DELETE_CONFIRMATION = "계정 삭제";

export function hasValidDeleteConfirmation(value: unknown): boolean {
  return value === ACCOUNT_DELETE_CONFIRMATION;
}

export function isSameOrigin(origin: string | null, expectedOrigin: string): boolean {
  return origin === expectedOrigin;
}
