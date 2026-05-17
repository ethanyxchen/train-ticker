import type { JourneySnapshotTone } from "./types";

export type BoardRowFieldKey =
  | "time"
  | "origin"
  | "destination"
  | "operator"
  | "platform"
  | "status";

export interface BoardRowSnapshot {
  optionId?: string;
  time: string;
  origin: string;
  destination: string;
  operator: string;
  platform: string;
  status: string;
  statusTone: JourneySnapshotTone;
}

export type BoardRowAnimationState = Record<BoardRowFieldKey, boolean>;

const BOARD_ROW_FIELDS: readonly BoardRowFieldKey[] = [
  "time",
  "origin",
  "destination",
  "operator",
  "platform",
  "status",
];

const CRITICAL_BOARD_ROW_FIELDS: readonly BoardRowFieldKey[] = [
  "time",
  "platform",
  "status",
];

function createBoardRowAnimationState(
  enabledFields: readonly BoardRowFieldKey[],
): BoardRowAnimationState {
  return {
    time: enabledFields.includes("time"),
    origin: enabledFields.includes("origin"),
    destination: enabledFields.includes("destination"),
    operator: enabledFields.includes("operator"),
    platform: enabledFields.includes("platform"),
    status: enabledFields.includes("status"),
  };
}

export function getBoardRowKey(
  row: Pick<BoardRowSnapshot, "optionId">,
  fallbackKey: string,
) {
  return row.optionId ?? fallbackKey;
}

export function getBoardRowAnimationStates(
  rows: readonly BoardRowSnapshot[],
  previousRows: readonly BoardRowSnapshot[],
  fallbackKey: string,
  {
    animateAllFields = false,
    suppressNewRows = false,
  }: {
    animateAllFields?: boolean;
    suppressNewRows?: boolean;
  } = {},
) {
  const previousRowsByKey = new Map(
    previousRows.map((row) => [getBoardRowKey(row, fallbackKey), row]),
  );

  return rows.map((row) => {
    if (animateAllFields) {
      return createBoardRowAnimationState(BOARD_ROW_FIELDS);
    }

    const previousRow = previousRowsByKey.get(getBoardRowKey(row, fallbackKey));

    if (!previousRow) {
      return suppressNewRows
        ? createBoardRowAnimationState([])
        : createBoardRowAnimationState(CRITICAL_BOARD_ROW_FIELDS);
    }

    return {
      time: previousRow.time !== row.time,
      origin: false,
      destination: false,
      operator: false,
      platform: previousRow.platform !== row.platform,
      status:
        previousRow.status !== row.status ||
        previousRow.statusTone !== row.statusTone,
    };
  });
}
