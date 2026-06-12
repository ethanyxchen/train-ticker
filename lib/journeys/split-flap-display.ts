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

function getSplitFlapCharacterIndex(character: string) {
  return SPLIT_FLAP_CHARACTERS.indexOf(normalizeSplitFlapCharacter(character));
}

export function getNextSplitFlapValue(value: string) {
  return Array.from(value, (character) => {
    const index = getSplitFlapCharacterIndex(character);

    return SPLIT_FLAP_CHARACTERS[(index + 1) % SPLIT_FLAP_CHARACTERS.length];
  }).join("");
}

export function getMaxSplitFlapInitialStepCount(value: string) {
  return Math.max(
    ...Array.from(value, (character) => getSplitFlapCharacterIndex(character) + 1),
    0,
  );
}

export function getMaxSplitFlapForwardStepCount(from: string, to: string) {
  const length = Math.max(from.length, to.length);

  return Math.max(
    ...Array.from({ length }, (_, index) => {
      const fromIndex = getSplitFlapCharacterIndex(from[index] ?? " ");
      const toIndex = getSplitFlapCharacterIndex(to[index] ?? " ");

      return (
        (toIndex - fromIndex + SPLIT_FLAP_CHARACTERS.length) %
        SPLIT_FLAP_CHARACTERS.length
      );
    }),
    0,
  );
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
