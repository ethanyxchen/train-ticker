"use client";

import { useId, useMemo, type CSSProperties } from "react";

import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";

type MapPoint = {
  x: number;
  y: number;
};

type RoutePaletteColor = {
  color: string;
  glow: string;
};

export type JourneyLiveMapStation = MapPoint & {
  id: string;
  label: string;
  terminal: boolean;
};

export type JourneyLiveMapService = {
  id: string;
  direction: "outbound" | "inbound";
  delayMinutes: number;
  durationSeconds: number;
  offsetSeconds: number;
};

export type JourneyLiveMapModel = {
  routePath: string;
  routeColor: string;
  routeGlow: string;
  routeLabel: string;
  stations: JourneyLiveMapStation[];
  services: JourneyLiveMapService[];
};

interface JourneyLiveMapProps {
  journey: SavedJourney;
  snapshot: JourneySnapshot | undefined;
  refreshing: boolean;
}

type JourneyLiveMapStyle = CSSProperties & {
  "--journey-route-color": string;
  "--journey-route-glow": string;
};

const ROUTE_POINTS: readonly MapPoint[] = [
  { x: 9, y: 72 },
  { x: 20, y: 65 },
  { x: 31, y: 55 },
  { x: 44, y: 49 },
  { x: 58, y: 37 },
  { x: 74, y: 30 },
  { x: 88, y: 22 },
];

const INTERMEDIATE_STATIONS = [
  "City Thameslink",
  "Farringdon",
  "Blackfriars",
  "West Hampstead",
  "Kentish Town",
  "Mill Hill Broadway",
  "Radlett",
  "St Albans City",
  "Harpenden",
  "Luton Airport Parkway",
  "East Croydon",
  "Gatwick Airport",
  "Clapham Junction",
  "Wimbledon",
  "Surbiton",
  "Watford Junction",
  "Harrow & Wealdstone",
];

const ROUTE_PALETTE: readonly RoutePaletteColor[] = [
  { color: "#00a0e2", glow: "rgba(0, 160, 226, 0.42)" },
  { color: "#e32017", glow: "rgba(227, 32, 23, 0.42)" },
  { color: "#00782a", glow: "rgba(0, 120, 42, 0.42)" },
  { color: "#b36305", glow: "rgba(179, 99, 5, 0.48)" },
  { color: "#9b0056", glow: "rgba(155, 0, 86, 0.44)" },
  { color: "#f3a9bb", glow: "rgba(243, 169, 187, 0.38)" },
];

const SERVICE_TIMINGS: readonly Omit<JourneyLiveMapService, "id">[] = [
  {
    direction: "outbound",
    delayMinutes: 0,
    durationSeconds: 34,
    offsetSeconds: -4,
  },
  {
    direction: "outbound",
    delayMinutes: 2,
    durationSeconds: 42,
    offsetSeconds: -20,
  },
  {
    direction: "outbound",
    delayMinutes: 0,
    durationSeconds: 29,
    offsetSeconds: -31,
  },
  {
    direction: "inbound",
    delayMinutes: 0,
    durationSeconds: 38,
    offsetSeconds: -10,
  },
  {
    direction: "inbound",
    delayMinutes: 4,
    durationSeconds: 46,
    offsetSeconds: -27,
  },
];

function getJourneyHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1_000_003;
  }

  return hash;
}

function getRoutePath(points: readonly MapPoint[]) {
  const [start, ...rest] = points;

  if (!start) {
    return "";
  }

  return rest.reduce((path, point, index) => {
    const previous = points[index];

    if (!previous) {
      return path;
    }

    const midpointX = (previous.x + point.x) / 2;

    return `${path} C ${midpointX} ${previous.y}, ${midpointX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${start.x} ${start.y}`);
}

function getIntermediateStationLabels(journey: SavedJourney, count: number) {
  const start = getJourneyHash(journey.id) % INTERMEDIATE_STATIONS.length;

  return Array.from(
    { length: count },
    (_, index) =>
      INTERMEDIATE_STATIONS[
        (start + index * 2) % INTERMEDIATE_STATIONS.length
      ],
  );
}

function getRoutePalette(journey: SavedJourney) {
  return (
    ROUTE_PALETTE[getJourneyHash(journey.id) % ROUTE_PALETTE.length] ??
    ROUTE_PALETTE[0]
  );
}

function getRouteLabel(journey: SavedJourney) {
  return `${journey.origin.id.toUpperCase()} / ${journey.destination.id.toUpperCase()}`;
}

function getStationLabel(
  journey: SavedJourney,
  intermediateLabels: readonly string[],
  index: number,
  lastIndex: number,
) {
  if (index === 0) {
    return journey.origin.label;
  }

  if (index === lastIndex) {
    return journey.destination.label;
  }

  return intermediateLabels[index - 1] ?? "";
}

export function getJourneyLiveMapModel(journey: SavedJourney): JourneyLiveMapModel {
  const routePalette = getRoutePalette(journey);
  const lastStationIndex = ROUTE_POINTS.length - 1;
  const intermediateLabels = getIntermediateStationLabels(
    journey,
    Math.max(ROUTE_POINTS.length - 2, 0),
  );

  return {
    routePath: getRoutePath(ROUTE_POINTS),
    routeColor: routePalette.color,
    routeGlow: routePalette.glow,
    routeLabel: getRouteLabel(journey),
    stations: ROUTE_POINTS.map((point, index) => ({
      ...point,
      id: `${journey.id}:station:${index}`,
      label: getStationLabel(journey, intermediateLabels, index, lastStationIndex),
      terminal: index === 0 || index === lastStationIndex,
    })),
    services: SERVICE_TIMINGS.map((service, index) => ({
      ...service,
      id: `${journey.id}:service:${index + 1}`,
    })),
  };
}

function getMapBuilding(index: number) {
  const columns = 12;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = column * 8.8 + 1.4 + (row % 2) * 1.8;
  const y = row * 12.4 + 3.5;
  const distanceFromRoute = Math.abs(y - (82 - x * 0.7));

  if (x > 96 || y > 92 || distanceFromRoute < 6) {
    return null;
  }

  return {
    x,
    y,
    width: 4.2 + ((index * 7) % 4),
    height: 3.6 + ((index * 11) % 5),
    depth: 1.2 + ((index * 5) % 4) * 0.32,
  };
}

function getServiceLabel(journey: SavedJourney, service: JourneyLiveMapService) {
  const destination =
    service.direction === "outbound" ? journey.destination : journey.origin;

  return `${destination.id.toUpperCase()} ${service.id.split(":").at(-1)}`;
}

function getServiceStatus(service: JourneyLiveMapService) {
  return service.delayMinutes > 0
    ? `${service.delayMinutes} min late`
    : "On time";
}

function getServiceDestination(
  journey: SavedJourney,
  service: JourneyLiveMapService,
) {
  return service.direction === "outbound"
    ? journey.destination.label
    : journey.origin.label;
}

function getServiceAriaLabel(
  journey: SavedJourney,
  service: JourneyLiveMapService,
) {
  return `${getServiceLabel(journey, service)} to ${getServiceDestination(
    journey,
    service,
  )}, ${getServiceStatus(service)}`;
}

function getMotionDirection(service: JourneyLiveMapService) {
  return service.direction === "outbound"
    ? { keyPoints: "0;1", keyTimes: "0;1" }
    : { keyPoints: "1;0", keyTimes: "0;1" };
}

function JourneyLiveMapTrain({
  journey,
  pathId,
  service,
}: {
  journey: SavedJourney;
  pathId: string;
  service: JourneyLiveMapService;
}) {
  const motionDirection = getMotionDirection(service);

  return (
    <g
      aria-label={getServiceAriaLabel(journey, service)}
      className="journey-live-map-service"
      role="img"
      tabIndex={0}
    >
      <animateMotion
        begin={`${service.offsetSeconds}s`}
        calcMode="linear"
        dur={`${service.durationSeconds}s`}
        keyPoints={motionDirection.keyPoints}
        keyTimes={motionDirection.keyTimes}
        repeatCount="indefinite"
        rotate="auto"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <circle className="journey-live-map-service-pulse" r="2.2" />
      <rect
        className="journey-live-map-service-body"
        height="2.4"
        rx="1.1"
        width="4.8"
        x="-2.4"
        y="-1.2"
      />
      <circle
        className="journey-live-map-service-light"
        cx="1.25"
        cy="0"
        r="0.46"
      />
      <foreignObject
        className="journey-live-map-service-detail"
        height="16"
        width="28"
        x="3.4"
        y="-16"
      >
        <div>
          <strong>{getServiceLabel(journey, service)}</strong>
          <span>{getServiceDestination(journey, service)}</span>
          <span>{getServiceStatus(service)}</span>
        </div>
      </foreignObject>
    </g>
  );
}

function JourneyLiveMapStationMarker({
  station,
}: {
  station: JourneyLiveMapStation;
}) {
  const terminalAtStart = station.terminal && station.x < 50;
  const labelX = station.terminal
    ? terminalAtStart
      ? station.x + 3
      : station.x - 22
    : station.x + 2.7;
  const labelY = station.terminal
    ? terminalAtStart
      ? station.y - 9
      : station.y + 3
    : station.y - 6;

  return (
    <g className="journey-live-map-station">
      <circle
        className={
          station.terminal
            ? "journey-live-map-station-node terminal"
            : "journey-live-map-station-node"
        }
        cx={station.x}
        cy={station.y}
        r={station.terminal ? 2.2 : 1.5}
      />
      <foreignObject
        className={
          station.terminal
            ? "journey-live-map-station-label terminal"
            : "journey-live-map-station-label"
        }
        height={station.terminal ? 10 : 9}
        width={station.terminal ? 22 : 18}
        x={labelX}
        y={labelY}
      >
        <span>{station.label}</span>
      </foreignObject>
    </g>
  );
}

function JourneyLiveMapBuildings() {
  return (
    <g className="journey-live-map-buildings">
      {Array.from({ length: 96 }, (_, index) => {
        const building = getMapBuilding(index);

        if (!building) {
          return null;
        }

        return (
          <g key={index} transform={`translate(${building.x} ${building.y})`}>
            <path
              className="journey-live-map-building-depth"
              d={`M 0 ${building.height} L ${building.depth} ${building.height + building.depth} L ${building.width + building.depth} ${building.height + building.depth} L ${building.width} ${building.height} Z`}
            />
            <rect
              className="journey-live-map-building"
              height={building.height}
              rx="0.5"
              width={building.width}
            />
          </g>
        );
      })}
    </g>
  );
}

function JourneyLiveMapRoads() {
  return (
    <g className="journey-live-map-roads">
      {Array.from({ length: 8 }, (_, index) => (
        <path
          key={`horizontal-${index}`}
          d={`M -5 ${12 + index * 11} C 24 ${18 + index * 7}, 64 ${6 + index * 10}, 108 ${13 + index * 9}`}
        />
      ))}
      {Array.from({ length: 7 }, (_, index) => (
        <path
          key={`vertical-${index}`}
          d={`M ${6 + index * 15} -4 C ${2 + index * 13} 22, ${14 + index * 12} 62, ${4 + index * 15} 105`}
        />
      ))}
    </g>
  );
}

export function JourneyLiveMap({
  journey,
  snapshot,
  refreshing,
}: JourneyLiveMapProps) {
  const routePathId = `journey-live-map-route-${useId().replace(/:/g, "")}`;
  const model = useMemo(() => getJourneyLiveMapModel(journey), [journey]);
  const style: JourneyLiveMapStyle = {
    "--journey-route-color": model.routeColor,
    "--journey-route-glow": model.routeGlow,
  };

  return (
    <section
      aria-label={`${journey.name} live map`}
      className="journey-live-map"
      style={style}
    >
      <div className="journey-live-map-chrome top-left">
        <span className="active">MAP</span>
        <span>BOARD</span>
      </div>

      <div className="journey-live-map-chrome top-right" role="status">
        <span className={refreshing ? "syncing" : "live"}>
          {refreshing ? "SYNC" : "LIVE"}
        </span>
      </div>

      <div className="journey-live-map-route-card">
        <span>{model.routeLabel}</span>
        <strong>{journey.origin.label}</strong>
        <span>to {journey.destination.label}</span>
        <span>
          {model.services.length} active services
          {snapshot ? ` / ${snapshot.headline}` : ""}
        </span>
      </div>

      <div aria-hidden="true" className="journey-live-map-controls">
        <span>+</span>
        <span>-</span>
        <span>3D</span>
      </div>

      <div className="journey-live-map-canvas">
        <svg
          className="journey-live-map-svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path
            className="journey-live-map-river"
            d="M -6 88 C 12 80, 19 92, 35 84 C 52 75, 64 90, 82 77 C 94 69, 103 71, 108 68 L 108 106 L -6 106 Z"
          />
          <JourneyLiveMapRoads />
          <JourneyLiveMapBuildings />
          <path className="journey-live-map-track-shadow" d={model.routePath} />
          <path
            className="journey-live-map-track-halo"
            d={model.routePath}
          />
          <path
            className="journey-live-map-track"
            d={model.routePath}
            id={routePathId}
          />
          {model.stations.map((station) => (
            <JourneyLiveMapStationMarker key={station.id} station={station} />
          ))}
          {model.services.map((service) => (
            <JourneyLiveMapTrain
              key={service.id}
              journey={journey}
              pathId={routePathId}
              service={service}
            />
          ))}
        </svg>
      </div>

      <div className="journey-live-map-attribution">Journey layer / Open map</div>
    </section>
  );
}
