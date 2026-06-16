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

test("renders live map chrome for the selected journey", () => {
  const html = renderToString(
    React.createElement(JourneyLiveMap, {
      journey,
      snapshot: undefined,
      refreshing: false,
    }),
  );

  assert.match(html, /London St Pancras International/);
  assert.match(html, /Leicester/);
  assert.match(html, /MAP/);
  assert.match(html, /BOARD/);
  assert.match(html, /LIVE/);
  assert.match(html, /active services/);
});
