const KNOWN_OPERATOR_ABBREVIATIONS: Record<string, string> = {
  "East Midlands Railway": "EMR",
  "Elizabeth line": "ELI",
  "Greater Anglia": "GA",
  "Great Northern": "GN",
  "London Northwestern Railway": "LNR",
  Thameslink: "TL",
};

function abbreviateOperatorName(name?: string): string {
  const trimmed = name?.trim();

  if (!trimmed) {
    return "--";
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const knownAbbreviation = KNOWN_OPERATOR_ABBREVIATIONS[normalized];

  if (knownAbbreviation) {
    return knownAbbreviation;
  }

  const firstSegment = normalized.split(/[\/,]/)[0]?.trim() ?? normalized;
  const words = firstSegment
    .replace(/['’]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "--";
  }

  if (words.length === 1) {
    return words[0]!.slice(0, 3).toUpperCase();
  }

  return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
}

export function getBoardOperatorLabel({
  operator,
  operatorCode,
}: {
  operator?: string;
  operatorCode?: string;
}): string {
  const trimmedCode = operatorCode?.trim().toUpperCase();

  if (trimmedCode) {
    return trimmedCode.slice(0, 3);
  }

  return abbreviateOperatorName(operator);
}
