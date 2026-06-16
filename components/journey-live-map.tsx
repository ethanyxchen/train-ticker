"use client";

import nationalRailStations from "uk-railway-stations/stations.json";
import { useId, useMemo, type CSSProperties } from "react";

import type { SavedJourney } from "@/lib/journeys/types";

type MapPoint = {
  x: number;
  y: number;
};

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type RoutePaletteColor = {
  color: string;
  glow: string;
};

type NationalRailStationCoordinate = {
  crsCode: string;
  lat: number;
  long: number;
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

export type JourneyLiveMapTile = {
  id: string;
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type JourneyLiveMapModel = {
  mapAspectRatio: number;
  routePath: string;
  routeColor: string;
  routeGlow: string;
  routeLabel: string;
  stations: JourneyLiveMapStation[];
  services: JourneyLiveMapService[];
  tiles: JourneyLiveMapTile[];
};

interface JourneyLiveMapProps {
  journey: SavedJourney;
}

type JourneyLiveMapStyle = CSSProperties & {
  "--journey-map-aspect-ratio": number;
  "--journey-route-color": string;
  "--journey-route-glow": string;
};

const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
const MAPTILER_MAP_ID = "dataviz-dark";
const MAPTILER_TILE_SIZE = 256;
const UK_MAP_ZOOM = 6;
const UK_MAP_BOUNDS = {
  west: -9.8,
  north: 61.2,
  east: 2.4,
  south: 49.4,
} as const;
const DEFAULT_ORIGIN: GeoPoint = {
  latitude: 51.531921,
  longitude: -0.126361,
};
const DEFAULT_DESTINATION: GeoPoint = {
  latitude: 52.631397,
  longitude: -1.125274,
};
const STATION_COORDINATES = nationalRailStations as readonly NationalRailStationCoordinate[];
const STATION_COORDINATES_BY_CRS = new Map(
  STATION_COORDINATES.map((station) => [station.crsCode, station]),
);
const INTERMEDIATE_STATIONS = [
  "Watford Junction",
  "Milton Keynes Central",
  "Rugby",
  "Nuneaton",
  "Market Harborough",
  "Bedford",
  "Luton Airport Parkway",
  "St Albans City",
  "Peterborough",
  "Stevenage",
  "Grantham",
  "Nottingham",
  "Derby",
  "Sheffield",
  "Crewe",
  "Stafford",
  "Wolverhampton",
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

function getTilePoint(longitude: number, latitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const latitudeRadians = (latitude * Math.PI) / 180;

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      ((1 -
        Math.log(
          Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
        ) /
          Math.PI) /
        2) *
      scale,
  };
}

function getUkMapView() {
  const northWest = getTilePoint(
    UK_MAP_BOUNDS.west,
    UK_MAP_BOUNDS.north,
    UK_MAP_ZOOM,
  );
  const southEast = getTilePoint(
    UK_MAP_BOUNDS.east,
    UK_MAP_BOUNDS.south,
    UK_MAP_ZOOM,
  );

  return {
    northWest,
    southEast,
    width: southEast.x - northWest.x,
    height: southEast.y - northWest.y,
  };
}

function projectToUkMap(point: GeoPoint): MapPoint {
  const view = getUkMapView();
  const tilePoint = getTilePoint(point.longitude, point.latitude, UK_MAP_ZOOM);

  return {
    x: ((tilePoint.x - view.northWest.x) / view.width) * 100,
    y: ((tilePoint.y - view.northWest.y) / view.height) * 100,
  };
}

function getMapTilerTileUrl({
  apiKey,
  x,
  y,
}: {
  apiKey: string;
  x: number;
  y: number;
}) {
  return `https://api.maptiler.com/maps/${MAPTILER_MAP_ID}/${MAPTILER_TILE_SIZE}/${UK_MAP_ZOOM}/${x}/${y}.png?key=${encodeURIComponent(apiKey)}`;
}

export function getJourneyLiveMapTiles(
  apiKey: string | undefined = MAPTILER_API_KEY,
): JourneyLiveMapTile[] {
  if (!apiKey) {
    return [];
  }

  const view = getUkMapView();
  const minX = Math.floor(view.northWest.x);
  const maxX = Math.floor(view.southEast.x);
  const minY = Math.floor(view.northWest.y);
  const maxY = Math.floor(view.southEast.y);
  const tiles: JourneyLiveMapTile[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      tiles.push({
        id: `${UK_MAP_ZOOM}:${x}:${y}`,
        url: getMapTilerTileUrl({ apiKey, x, y }),
        left: ((x - view.northWest.x) / view.width) * 100,
        top: ((y - view.northWest.y) / view.height) * 100,
        width: (1 / view.width) * 100,
        height: (1 / view.height) * 100,
      });
    }
  }

  return tiles;
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

function getJourneyEndpoint(
  stationId: string,
  fallback: GeoPoint,
): GeoPoint {
  const station = STATION_COORDINATES_BY_CRS.get(stationId.toUpperCase());

  if (!station) {
    return fallback;
  }

  return {
    latitude: station.lat,
    longitude: station.long,
  };
}

function getRoutePoints(journey: SavedJourney) {
  const origin = projectToUkMap(
    getJourneyEndpoint(journey.origin.id, DEFAULT_ORIGIN),
  );
  const destination = projectToUkMap(
    getJourneyEndpoint(journey.destination.id, DEFAULT_DESTINATION),
  );
  const bend = Math.max(
    5,
    Math.min(17, Math.abs(origin.x - destination.x) * 0.34),
  );
  const firstMidpoint = {
    x: origin.x + (destination.x - origin.x) * 0.34 - bend,
    y: origin.y + (destination.y - origin.y) * 0.34,
  };
  const secondMidpoint = {
    x: origin.x + (destination.x - origin.x) * 0.68 + bend,
    y: origin.y + (destination.y - origin.y) * 0.68,
  };

  return [origin, firstMidpoint, secondMidpoint, destination];
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
  const routePoints = getRoutePoints(journey);
  const view = getUkMapView();
  const lastStationIndex = routePoints.length - 1;
  const intermediateLabels = getIntermediateStationLabels(
    journey,
    Math.max(routePoints.length - 2, 0),
  );

  return {
    mapAspectRatio: view.width / view.height,
    routePath: getRoutePath(routePoints),
    routeColor: routePalette.color,
    routeGlow: routePalette.glow,
    routeLabel: getRouteLabel(journey),
    stations: routePoints.map((point, index) => ({
      ...point,
      id: `${journey.id}:station:${index}`,
      label: getStationLabel(journey, intermediateLabels, index, lastStationIndex),
      terminal: index === 0 || index === lastStationIndex,
    })),
    services: SERVICE_TIMINGS.map((service, index) => ({
      ...service,
      id: `${journey.id}:service:${index + 1}`,
    })),
    tiles: getJourneyLiveMapTiles(),
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
  return (
    <g
      aria-label={station.label}
      className="journey-live-map-station"
      role="img"
    >
      <circle
        className={
          station.terminal
            ? "journey-live-map-station-node terminal"
            : "journey-live-map-station-node"
        }
        cx={station.x}
        cy={station.y}
        r={station.terminal ? 2.2 : 1.35}
      />
    </g>
  );
}

function JourneyLiveMapTileLayer({
  tiles,
}: {
  tiles: readonly JourneyLiveMapTile[];
}) {
  if (tiles.length === 0) {
    return <div className="journey-live-map-tile-fallback" />;
  }

  return (
    <>
      {tiles.map((tile) => (
        <div
          aria-hidden="true"
          className="journey-live-map-tile"
          key={tile.id}
          style={{
            backgroundImage: `url("${tile.url}")`,
            height: `${tile.height}%`,
            left: `${tile.left}%`,
            top: `${tile.top}%`,
            width: `${tile.width}%`,
          }}
        />
      ))}
    </>
  );
}

export function JourneyLiveMap({ journey }: JourneyLiveMapProps) {
  const routePathId = `journey-live-map-route-${useId().replace(/:/g, "")}`;
  const model = useMemo(() => getJourneyLiveMapModel(journey), [journey]);
  const style: JourneyLiveMapStyle = {
    "--journey-map-aspect-ratio": model.mapAspectRatio,
    "--journey-route-color": model.routeColor,
    "--journey-route-glow": model.routeGlow,
  };

  return (
    <section
      aria-label={`${journey.name} live map`}
      className="journey-live-map"
      style={style}
    >
      <div className="journey-live-map-viewport">
        <div className="journey-live-map-tiles" aria-hidden="true">
          <JourneyLiveMapTileLayer tiles={model.tiles} />
        </div>

        <svg
          aria-label={`${model.routeLabel} active services`}
          className="journey-live-map-svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path className="journey-live-map-track-shadow" d={model.routePath} />
          <path className="journey-live-map-track-halo" d={model.routePath} />
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

      <div className="journey-live-map-attribution">
        <a href="https://www.maptiler.com/" rel="noreferrer" target="_blank">
          © MapTiler
        </a>
        <span>© OpenStreetMap contributors</span>
      </div>
    </section>
  );
}
