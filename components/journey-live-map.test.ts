import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

import {
  JourneyLiveMap,
  getJourneyLiveMapModel,
} from "./journey-live-map.tsx";
import { createSavedJourney } from "@/lib/journeys/identity";

const journey = createSavedJourney({
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

test("builds a selected journey route with dummy active services", () => {
  const model = getJourneyLiveMapModel(journey);

  assert.equal(model.routeLabel, "STP / LEI");
  assert.equal(model.stations.at(0)?.label, journey.origin.label);
  assert.equal(model.stations.at(-1)?.label, journey.destination.label);
  assert.equal(model.stations.at(0)?.terminal, true);
  assert.equal(model.stations.at(-1)?.terminal, true);
  assert.equal(model.services.length, 5);
  assert.equal(model.routeCoordinates.length, 72);
  assert.equal(
    model.services.some((service) => service.direction === "inbound"),
    true,
  );
  assert.equal(
    model.services.some((service) => service.direction === "outbound"),
    true,
  );
});

test("builds dynamic map bounds around the selected journey", () => {
  const model = getJourneyLiveMapModel(journey);
  const [[west, south], [east, north]] = model.bounds as [
    [number, number],
    [number, number],
  ];

  assert.equal(west < -1.12, true);
  assert.equal(east > -0.13, true);
  assert.equal(south < 51.54, true);
  assert.equal(north > 52.63, true);
  assert.equal(east - west < 2, true);
  assert.equal(north - south < 2, true);
});

test("renders the selected journey as one map-backed page", () => {
  const html = renderToString(
    React.createElement(JourneyLiveMap, {
      journey,
    }),
  );

  assert.match(html, /London St Pancras International/);
  assert.match(html, /Leicester/);
  assert.match(html, /active services/);
  assert.match(html, /OpenStreetMap contributors/);
  assert.match(html, /journey-live-map-canvas/);
  assert.equal(html.includes("<svg"), false);
  assert.equal(html.includes("MAP"), false);
  assert.equal(html.includes("BOARD"), false);
  assert.equal(html.includes("+"), false);
});
