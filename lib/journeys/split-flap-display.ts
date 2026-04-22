export const SPLIT_FLAP_CHARACTERS = [
  " ",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  ":",
  "-",
] as const;

const SPLIT_FLAP_CHARACTER_SET = new Set<string>(SPLIT_FLAP_CHARACTERS);

export function normalizeSplitFlapCharacter(value: string) {
  const normalized = value.slice(0, 1).toUpperCase();

  return SPLIT_FLAP_CHARACTER_SET.has(normalized) ? normalized : " ";
}

export function getPaddedSplitFlapValue(
  value: string,
  length: number,
  align: "left" | "right",
) {
  const sanitized = value.toUpperCase().replace(/\s+/g, " ").slice(0, length);
  const padded =
    align === "right"
      ? sanitized.padStart(length, " ")
      : sanitized.padEnd(length, " ");

  return Array.from(padded, normalizeSplitFlapCharacter).join("");
}
