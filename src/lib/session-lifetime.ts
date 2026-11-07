export const DEFAULT_SESSION_SECONDS = 8 * 60 * 60;
export const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;

export function sessionDeadline(nowSeconds: number, remember: boolean): number {
  return nowSeconds + (remember ? REMEMBERED_SESSION_SECONDS : DEFAULT_SESSION_SECONDS);
}

export function isSessionWithinDeadline(
  token: Record<string, unknown>,
  nowSeconds: number,
): boolean {
  const deadline = typeof token.sessionDeadline === "number"
    ? token.sessionDeadline
    : typeof token.iat === "number" ? token.iat + DEFAULT_SESSION_SECONDS : 0;
  return Number.isFinite(deadline) && nowSeconds < deadline;
}
