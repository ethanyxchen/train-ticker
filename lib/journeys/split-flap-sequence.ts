export const SPLIT_FLAP_SWITCH_ORDER = [
  " ",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  ":",
  "-",
] as const;

const SPLIT_FLAP_SWITCH_INDEX = new Map(
  SPLIT_FLAP_SWITCH_ORDER.map((character, index) => [character, index]),
);

export function normalizeSplitFlapCharacter(value: string) {
  const normalized = value.slice(0, 1).toUpperCase();

  return SPLIT_FLAP_SWITCH_INDEX.has(normalized) ? normalized : " ";
}

export function getSplitFlapSequence(
  fromCharacter: string,
  toCharacter: string,
  options?: {
    forceFullCycle?: boolean;
  },
) {
  const normalizedFromCharacter = normalizeSplitFlapCharacter(fromCharacter);
  const normalizedToCharacter = normalizeSplitFlapCharacter(toCharacter);
  const orderLength = SPLIT_FLAP_SWITCH_ORDER.length;
  const fromIndex = SPLIT_FLAP_SWITCH_INDEX.get(normalizedFromCharacter) ?? 0;
  const toIndex = SPLIT_FLAP_SWITCH_INDEX.get(normalizedToCharacter) ?? 0;
  let stepCount = (toIndex - fromIndex + orderLength) % orderLength;

  if (options?.forceFullCycle && stepCount === 0) {
    stepCount = orderLength;
  }

  if (stepCount === 0) {
    return [normalizedToCharacter];
  }

  return Array.from({ length: stepCount + 1 }, (_, offset) => {
    const nextIndex = (fromIndex + offset) % orderLength;

    return SPLIT_FLAP_SWITCH_ORDER[nextIndex] ?? " ";
  });
}
