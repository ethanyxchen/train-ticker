import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

import {
  JourneyLiveMap,
  getJourneyLiveMapModel,
  getJourneyLiveMapTiles,
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
  assert.equal(model.mapAspectRatio > 0, true);
  assert.equal(
    model.services.some((service) => service.direction === "inbound"),
    true,
  );
  assert.equal(
    model.services.some((service) => service.direction === "outbound"),
    true,
  );
  assert.equal(model.routePath.startsWith("M "), true);
});

test("builds MapTiler UK background tiles", () => {
  const tiles = getJourneyLiveMapTiles("test-key");

  assert.equal(tiles.length > 0, true);
  assert.match(tiles[0]?.url ?? "", /api\.maptiler\.com\/maps\/dataviz-dark/);
  assert.match(tiles[0]?.url ?? "", /key=test-key/);
  assert.equal(tiles.every((tile) => tile.width > 0 && tile.height > 0), true);
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
  assert.equal(html.includes("MAP"), false);
  assert.equal(html.includes("BOARD"), false);
  assert.equal(html.includes("+"), false);
});
