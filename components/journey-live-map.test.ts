import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

import {
  JourneyLiveMap,
  getJourneyLiveMapModel,
} from "./journey-live-map.tsx";
import { createSavedJourney } from "@/lib/journeys/identity";
import type { JourneySnapshot } from "@/lib/journeys/types";

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
const snapshot: JourneySnapshot = {
  journeyId: journey.id,
  provider: "national-rail",
  status: "ok",
  headline: "Next matching service on time",
  subheadline: journey.name,
  refreshedAt: "2026-04-19T09:55:00Z",
  boardFields: [],
  options: [],
  alerts: [],
  routeStops: [
    journey.origin,
    {
      id: "WHP",
      label: "West Hampstead Thameslink",
    },
    {
      id: "LUT",
      label: "Luton",
    },
    journey.destination,
  ],
};

test("builds a selected journey route through every live stop", () => {
  const model = getJourneyLiveMapModel(journey, snapshot);

  assert.equal(model.routeLabel, "STP / LEI");
  assert.equal(model.stations.at(0)?.label, journey.origin.label);
  assert.equal(model.stations.at(-1)?.label, journey.destination.label);
  assert.equal(model.stations.at(0)?.terminal, true);
  assert.equal(model.stations.at(-1)?.terminal, true);
  assert.deepEqual(
    model.stations.map((station) => station.label),
    [
      "London St Pancras International",
      "West Hampstead Thameslink",
      "Luton",
      "Leicester",
    ],
  );
  assert.equal(model.services.length, 5);
  assert.deepEqual(model.routeCoordinates, [
    [-0.126361, 51.531921],
    [-0.1924, 51.548644],
    [-0.414881, 51.882233],
    [-1.125274, 52.631397],
  ]);
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
  const model = getJourneyLiveMapModel(journey, snapshot);
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
      snapshot,
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

test("renders a static map fallback until the MapTiler canvas loads", () => {
  const html = renderToString(
    React.createElement(JourneyLiveMap, {
      journey,
      maptilerApiKey: "test-key",
      snapshot,
    }),
  );

  assert.match(html, /journey-live-map-fallback/);
});
