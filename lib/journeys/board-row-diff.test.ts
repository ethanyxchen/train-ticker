import assert from "node:assert/strict";
import test from "node:test";

import {
  getBoardRowAnimationStates,
  getBoardRowKey,
  type BoardRowSnapshot,
} from "./board-row-diff";

function createBoardRow(
  optionId: string | undefined,
  overrides: Partial<BoardRowSnapshot> = {},
): BoardRowSnapshot {
  return {
    optionId,
    time: "10:05",
    origin: "STP",
    destination: "BDM",
    operator: "EMR",
    platform: "4",
    status: "ON TIME",
    statusTone: "good",
    ...overrides,
  };
}

test("uses the journey fallback key when a row has no option identity", () => {
  assert.equal(
    getBoardRowKey(createBoardRow(undefined), "fallback:journey-1"),
    "fallback:journey-1",
  );
});

test("keeps the first loaded board static without an intro animation", () => {
  const states = getBoardRowAnimationStates(
    [createBoardRow("service-1")],
    [],
    "fallback:journey-1",
    { suppressNewRows: true },
  );

  assert.deepEqual(states, [
    {
      time: false,
      origin: false,
      destination: false,
      operator: false,
      platform: false,
      status: false,
    },
  ]);
});

test("animates only critical fields for a newly appeared row after baseline", () => {
  const states = getBoardRowAnimationStates(
    [createBoardRow("service-2")],
    [createBoardRow("service-1")],
    "fallback:journey-1",
  );

  assert.deepEqual(states, [
    {
      time: true,
      origin: false,
      destination: false,
      operator: false,
      platform: true,
      status: true,
    },
  ]);
});

test("does not re-animate rows that only moved upward after the top row dropped off", () => {
  const previousRows = [
    createBoardRow("service-1", { time: "10:05" }),
    createBoardRow("service-2", { time: "10:10", platform: "5" }),
    createBoardRow("service-3", { time: "10:15", status: "DELAYED", statusTone: "warn" }),
  ];
  const nextRows = [
    createBoardRow("service-2", { time: "10:10", platform: "5" }),
    createBoardRow("service-3", { time: "10:15", status: "DELAYED", statusTone: "warn" }),
  ];

  const states = getBoardRowAnimationStates(
    nextRows,
    previousRows,
    "fallback:journey-1",
  );

  assert.deepEqual(states, [
    {
      time: false,
      origin: false,
      destination: false,
      operator: false,
      platform: false,
      status: false,
    },
    {
      time: false,
      origin: false,
      destination: false,
      operator: false,
      platform: false,
      status: false,
    },
  ]);
});

test("animates only fields whose displayed values changed for an existing row", () => {
  const previousRows = [createBoardRow("service-1")];
  const nextRows = [
    createBoardRow("service-1", {
      platform: "1",
      status: "10:07",
      statusTone: "warn",
    }),
  ];

  const states = getBoardRowAnimationStates(
    nextRows,
    previousRows,
    "fallback:journey-1",
  );

  assert.deepEqual(states, [
    {
      time: false,
      origin: false,
      destination: false,
      operator: false,
      platform: true,
      status: true,
    },
  ]);
});
