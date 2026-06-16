import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

import { TrainTickerApp } from "./train-ticker-app.tsx";

const STORAGE_KEY = "train-ticker.journey-definition.v1";
const storedJourney = JSON.stringify({
  provider: "national-rail",
  origin: {
    id: "STP",
    label: "London St Pancras International",
  },
  destination: {
    id: "LEI",
    label: "Leicester",
  },
});
const HARD_CODED_ALERT_MESSAGE =
  "Heads-up: service is experiencing an operational alert.";

function setWindow(value: Window | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
    writable: true,
  });
}

function setAlertFeatureFlag(value: string | undefined) {
  const key = "NEXT_PUBLIC_HARD_CODED_ALERTS";
  const previousValue = process.env[key];

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  return () => {
    if (previousValue === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = previousValue;
  };
}

function renderWithWindow(value: Window | undefined) {
  const originalWindow = globalThis.window;

  setWindow(value);

  try {
    return renderToString(React.createElement(TrainTickerApp));
  } finally {
    setWindow(originalWindow);
  }
}

test("renders the same startup shell before browser storage has loaded", () => {
  const restoreAlertFlag = setAlertFeatureFlag("false");
  const browserWindow = {
    localStorage: {
      getItem: (key: string) => (key === STORAGE_KEY ? storedJourney : null),
      removeItem: () => undefined,
      setItem: () => undefined,
    },
  } as Window;

  try {
    const serverHtml = renderWithWindow(undefined);
    const browserHtml = renderWithWindow(browserWindow);

    assert.equal(browserHtml, serverHtml);
    assert.equal(serverHtml.includes("Journey search"), false);
    assert.equal(serverHtml.includes("Change journey"), false);
    assert.equal(serverHtml.includes("Clear board"), false);
    assert.equal(serverHtml.includes("Command + K"), false);
    assert.equal(serverHtml.includes('aria-label="Command key"'), true);
    assert.equal(serverHtml.includes("+ K to search for a journey"), true);
    assert.equal(serverHtml.includes("Ethan Chen"), true);
    assert.equal(serverHtml.includes("https://github.com/ethanyxchen"), true);
    assert.equal(serverHtml.includes("Rail Data Marketplace"), true);
    assert.equal(serverHtml.includes("https://raildata.org.uk/"), true);
    assert.equal(browserHtml.includes(HARD_CODED_ALERT_MESSAGE), false);
  } finally {
    restoreAlertFlag();
  }
});

test("renders a hardcoded alert when enabled via env flag", () => {
  const restoreAlertFlag = setAlertFeatureFlag("true");
  const browserWindow = {
    localStorage: {
      getItem: (key: string) => (key === STORAGE_KEY ? storedJourney : null),
      removeItem: () => undefined,
      setItem: () => undefined,
    },
  } as Window;

  try {
    const browserHtml = renderWithWindow(browserWindow);

    assert.equal(
      browserHtml.includes("aria-label=\"Live notices\""),
      true,
    );
    assert.equal(browserHtml.includes(HARD_CODED_ALERT_MESSAGE), true);
  } finally {
    restoreAlertFlag();
  }
});
