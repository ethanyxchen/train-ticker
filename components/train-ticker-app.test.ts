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
  const browserWindow = {
    localStorage: {
      getItem: (key: string) => (key === STORAGE_KEY ? storedJourney : null),
      removeItem: () => undefined,
      setItem: () => undefined,
    },
  } as Window;

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
  assert.equal(
    serverHtml.includes(
      "https://raildata.org.uk/dataProduct/P-d81d6eaf-8060-4467-a339-1c833e50cbbe/specification",
    ),
    true,
  );
});
