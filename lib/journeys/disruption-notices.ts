import { stripHtml } from "./provider-utils";

const BLOCKED_NOTICE_PATTERNS = [
  /\bstep[-\s]?free\b.*\baccess\b|\baccess\b.*\bstep[-\s]?free\b/i,
] as const;

export function filterDisruptionNotices(notices: readonly string[]): string[] {
  return notices.filter((notice) => {
    const text = stripHtml(notice);

    return !BLOCKED_NOTICE_PATTERNS.some((pattern) => pattern.test(text));
  });
}
