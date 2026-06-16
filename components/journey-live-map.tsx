"use client";

import nationalRailStations from "uk-railway-stations/stations.json";
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
} from "geojson";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  StyleSpecification,
} from "@maptiler/sdk";

import type {
  JourneyLocation,
  JourneySnapshot,
  SavedJourney,
} from "@/lib/journeys/types";

type Coordinates = [number, number];
type MapLibreMap = InstanceType<typeof import("@maptiler/sdk").MapMLGL>;

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

export type JourneyLiveMapStation = {
  id: string;
  label: string;
  terminal: boolean;
  coordinates: Coordinates;
};

export type JourneyLiveMapService = {
  id: string;
  direction: "outbound" | "inbound";
  delayMinutes: number;
  durationSeconds: number;
  offsetSeconds: number;
};

export type JourneyLiveMapModel = {
  bounds: LngLatBoundsLike;
  center: Coordinates;
  routeColor: string;
  routeGlow: string;
  routeLabel: string;
  routeCoordinates: Coordinates[];
  stations: JourneyLiveMapStation[];
  services: JourneyLiveMapService[];
};

interface JourneyLiveMapProps {
  journey: SavedJourney;
  snapshot: JourneySnapshot | undefined;
}

type JourneyLiveMapStyle = CSSProperties & {
  "--journey-route-color": string;
  "--journey-route-glow": string;
};

type JourneyRouteProperties = {
  id: string;
};

type JourneyStationProperties = {
  id: string;
  label: string;
  terminal: boolean;
};

type JourneyServiceProperties = {
  id: string;
  direction: JourneyLiveMapService["direction"];
  status: string;
};

type JourneyRouteFeatureCollection = FeatureCollection<
  LineString,
  JourneyRouteProperties
>;

type JourneyStationFeatureCollection = FeatureCollection<
  Point,
  JourneyStationProperties
>;

type JourneyServiceFeatureCollection = FeatureCollection<
  Point,
  JourneyServiceProperties
>;

const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
const MAPTILER_ROUTE_SOURCE_ID = "journey-route";
const MAPTILER_STATIONS_SOURCE_ID = "journey-stations";
const MAPTILER_SERVICES_SOURCE_ID = "journey-services";
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

function getRoutePalette(journey: SavedJourney) {
  return (
    ROUTE_PALETTE[getJourneyHash(journey.id) % ROUTE_PALETTE.length] ??
    ROUTE_PALETTE[0]
  );
}

function getRouteLabel(journey: SavedJourney) {
  return `${journey.origin.id.toUpperCase()} / ${journey.destination.id.toUpperCase()}`;
}

function getStationCoordinates(
  stationId: string,
  fallback?: GeoPoint,
): Coordinates | null {
  const station = STATION_COORDINATES_BY_CRS.get(stationId.toUpperCase());

  if (!station) {
    return fallback ? toCoordinates(fallback) : null;
  }

  return [station.long, station.lat];
}

function toCoordinates(point: GeoPoint): Coordinates {
  return [point.longitude, point.latitude];
}

function getRouteBounds(routeCoordinates: readonly Coordinates[]): LngLatBoundsLike {
  const longitudes = routeCoordinates.map((coordinate) => coordinate[0]);
  const latitudes = routeCoordinates.map((coordinate) => coordinate[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const longitudePadding = Math.max((east - west) * 0.12, 0.1);
  const latitudePadding = Math.max((north - south) * 0.15, 0.08);

  return [
    [west - longitudePadding, south - latitudePadding],
    [east + longitudePadding, north + latitudePadding],
  ];
}

function getRouteCenter(routeCoordinates: readonly Coordinates[]): Coordinates {
  const bounds = getRouteBounds(routeCoordinates) as [
    Coordinates,
    Coordinates,
  ];

  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];
}

function getCoordinateAtProgress(
  routeCoordinates: readonly Coordinates[],
  progress: number,
) {
  const lastIndex = routeCoordinates.length - 1;
  const scaledProgress = Math.max(0, Math.min(1, progress)) * lastIndex;
  const startIndex = Math.floor(scaledProgress);
  const endIndex = Math.min(startIndex + 1, lastIndex);
  const segmentProgress = scaledProgress - startIndex;
  const start = routeCoordinates[startIndex] ?? routeCoordinates[0];
  const end = routeCoordinates[endIndex] ?? start;

  return [
    start[0] + (end[0] - start[0]) * segmentProgress,
    start[1] + (end[1] - start[1]) * segmentProgress,
  ] satisfies Coordinates;
}

function getLoopProgress(elapsedSeconds: number, durationSeconds: number) {
  return ((elapsedSeconds % durationSeconds) + durationSeconds) / durationSeconds;
}

function getServiceProgress(service: JourneyLiveMapService, nowMs: number) {
  const elapsedSeconds = nowMs / 1_000 + service.offsetSeconds;
  const progress = getLoopProgress(elapsedSeconds, service.durationSeconds);

  return service.direction === "outbound" ? progress : 1 - progress;
}

function getFallbackRouteStops(journey: SavedJourney): JourneyLocation[] {
  return [journey.origin, journey.destination];
}

function getJourneyRouteStops(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
) {
  return snapshot?.journeyId === journey.id && snapshot.routeStops.length >= 2
    ? snapshot.routeStops
    : getFallbackRouteStops(journey);
}

function getRouteStopCoordinates(
  stop: JourneyLocation,
  index: number,
  lastIndex: number,
) {
  const fallback =
    index === 0
      ? DEFAULT_ORIGIN
      : index === lastIndex
        ? DEFAULT_DESTINATION
        : undefined;

  return getStationCoordinates(stop.id, fallback);
}

function getRouteStations(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
) {
  const routeStops = getJourneyRouteStops(journey, snapshot);
  const lastIndex = routeStops.length - 1;

  return routeStops.flatMap((stop, index) => {
    const coordinates = getRouteStopCoordinates(stop, index, lastIndex);

    return coordinates
      ? [
          {
            id: `${journey.id}:station:${index}`,
            label: stop.label,
            terminal: index === 0 || index === lastIndex,
            coordinates,
          },
        ]
      : [];
  });
}

export function getJourneyLiveMapModel(
  journey: SavedJourney,
  snapshot: JourneySnapshot | undefined,
): JourneyLiveMapModel {
  const routePalette = getRoutePalette(journey);
  const stations = getRouteStations(journey, snapshot);
  const routeCoordinates = stations.map((station) => station.coordinates);

  return {
    bounds: getRouteBounds(routeCoordinates),
    center: getRouteCenter(routeCoordinates),
    routeColor: routePalette.color,
    routeGlow: routePalette.glow,
    routeLabel: getRouteLabel(journey),
    routeCoordinates,
    stations,
    services: SERVICE_TIMINGS.map((service, index) => ({
      ...service,
      id: `${journey.id}:service:${index + 1}`,
    })),
  };
}

function getServiceStatus(service: JourneyLiveMapService) {
  return service.delayMinutes > 0
    ? `${service.delayMinutes} min late`
    : "On time";
}

function getRouteFeatureCollection(
  model: JourneyLiveMapModel,
): JourneyRouteFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: model.routeLabel,
        },
        geometry: {
          type: "LineString",
          coordinates: model.routeCoordinates,
        },
      },
    ],
  };
}

function getStationFeatureCollection(
  model: JourneyLiveMapModel,
): JourneyStationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: model.stations.map((station) => ({
      type: "Feature",
      properties: {
        id: station.id,
        label: station.label,
        terminal: station.terminal,
      },
      geometry: {
        type: "Point",
        coordinates: station.coordinates,
      },
    })),
  };
}

function getServiceFeature(
  model: JourneyLiveMapModel,
  service: JourneyLiveMapService,
  nowMs: number,
): Feature<Point, JourneyServiceProperties> {
  return {
    type: "Feature",
    properties: {
      id: service.id,
      direction: service.direction,
      status: getServiceStatus(service),
    },
    geometry: {
      type: "Point",
      coordinates: getCoordinateAtProgress(
        model.routeCoordinates,
        getServiceProgress(service, nowMs),
      ),
    },
  };
}

function getServiceFeatureCollection(
  model: JourneyLiveMapModel,
  nowMs: number,
): JourneyServiceFeatureCollection {
  return {
    type: "FeatureCollection",
    features: model.services.map((service) =>
      getServiceFeature(model, service, nowMs),
    ),
  };
}

function getGeoJsonSource(map: MapLibreMap, sourceId: string) {
  return map.getSource(sourceId) as GeoJSONSource | undefined;
}

function getMapPadding(container: HTMLElement) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  return {
    top: Math.min(height * 0.42, 390),
    right: Math.min(width * 0.12, 170),
    bottom: Math.min(height * 0.1, 110),
    left: Math.min(width * 0.12, 170),
  };
}

function fitJourneyMap(
  map: MapLibreMap,
  model: JourneyLiveMapModel,
  container: HTMLElement,
) {
  map.resize();
  map.fitBounds(model.bounds, {
    duration: 0,
    maxZoom: 10.8,
    padding: getMapPadding(container),
  });
}

function addJourneyMapLayers(map: MapLibreMap, model: JourneyLiveMapModel) {
  map.addSource(MAPTILER_ROUTE_SOURCE_ID, {
    type: "geojson",
    data: getRouteFeatureCollection(model),
  });
  map.addSource(MAPTILER_STATIONS_SOURCE_ID, {
    type: "geojson",
    data: getStationFeatureCollection(model),
  });
  map.addSource(MAPTILER_SERVICES_SOURCE_ID, {
    type: "geojson",
    data: getServiceFeatureCollection(model, performance.now()),
  });

  map.addLayer({
    id: "journey-route-shadow",
    type: "line",
    source: MAPTILER_ROUTE_SOURCE_ID,
    paint: {
      "line-color": "#020304",
      "line-opacity": 0.86,
      "line-width": 13,
      "line-blur": 5,
    },
  });
  map.addLayer({
    id: "journey-route-halo",
    type: "line",
    source: MAPTILER_ROUTE_SOURCE_ID,
    paint: {
      "line-color": model.routeColor,
      "line-opacity": 0.32,
      "line-width": 10,
      "line-blur": 5,
    },
  });
  map.addLayer({
    id: "journey-route",
    type: "line",
    source: MAPTILER_ROUTE_SOURCE_ID,
    paint: {
      "line-color": model.routeColor,
      "line-opacity": 0.86,
      "line-width": 4,
    },
  });
  map.addLayer({
    id: "journey-station-halo",
    type: "circle",
    source: MAPTILER_STATIONS_SOURCE_ID,
    paint: {
      "circle-color": model.routeColor,
      "circle-opacity": 0.22,
      "circle-radius": ["case", ["get", "terminal"], 16, 10],
      "circle-blur": 0.35,
    },
  });
  map.addLayer({
    id: "journey-station",
    type: "circle",
    source: MAPTILER_STATIONS_SOURCE_ID,
    paint: {
      "circle-color": "#f7f4ee",
      "circle-radius": ["case", ["get", "terminal"], 6, 4],
      "circle-stroke-color": model.routeColor,
      "circle-stroke-opacity": ["case", ["get", "terminal"], 0.86, 0.42],
      "circle-stroke-width": ["case", ["get", "terminal"], 3, 2],
    },
  });
  map.addLayer({
    id: "journey-service-halo",
    type: "circle",
    source: MAPTILER_SERVICES_SOURCE_ID,
    paint: {
      "circle-color": model.routeColor,
      "circle-opacity": 0.2,
      "circle-radius": 14,
      "circle-blur": 0.2,
    },
  });
  map.addLayer({
    id: "journey-service",
    type: "circle",
    source: MAPTILER_SERVICES_SOURCE_ID,
    paint: {
      "circle-color": "#f7f4ee",
      "circle-radius": 6,
      "circle-stroke-color": model.routeColor,
      "circle-stroke-width": 3,
      "circle-stroke-opacity": 0.94,
    },
  });
}

export function JourneyLiveMap({ journey, snapshot }: JourneyLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const model = useMemo(
    () => getJourneyLiveMapModel(journey, snapshot),
    [journey, snapshot],
  );
  const style: JourneyLiveMapStyle = {
    "--journey-route-color": model.routeColor,
    "--journey-route-glow": model.routeGlow,
  };

  useEffect(() => {
    const container = containerRef.current;
    const apiKey = MAPTILER_API_KEY;

    if (!container || !apiKey) {
      return;
    }

    const maptilerApiKey = apiKey;
    const abortController = new AbortController();
    let animationFrameId = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    async function loadMap() {
      const sdk = await import("@maptiler/sdk");

      if (disposed || !container) {
        return;
      }

      const styleUrl = new URL(sdk.MapStyle.DATAVIZ.DARK.getExpandedStyleURL());
      styleUrl.searchParams.set("key", maptilerApiKey);

      let mapStyle: StyleSpecification;

      try {
        const response = await fetch(styleUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        mapStyle = (await response.json()) as StyleSpecification;
      } catch {
        return;
      }

      if (disposed || !container) {
        return;
      }

      const map = new sdk.MapMLGL({
        attributionControl: false,
        bearing: 0,
        center: model.center,
        container,
        dragRotate: false,
        hash: false,
        maplibreLogo: false,
        maxPitch: 0,
        pitch: 0,
        pitchWithRotate: false,
        style: mapStyle,
      });

      mapRef.current = map;

      map.on("load", () => {
        map.touchZoomRotate.disableRotation();
        fitJourneyMap(map, model, container);
        addJourneyMapLayers(map, model);
        resizeObserver = new ResizeObserver(() => {
          fitJourneyMap(map, model, container);
        });
        resizeObserver.observe(container);

        function animateServices(nowMs: number) {
          getGeoJsonSource(map, MAPTILER_SERVICES_SOURCE_ID)?.setData(
            getServiceFeatureCollection(model, nowMs),
          );
          animationFrameId = window.requestAnimationFrame(animateServices);
        }

        animationFrameId = window.requestAnimationFrame(animateServices);
      });
    }

    void loadMap();

    return () => {
      disposed = true;
      abortController.abort();
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [model]);

  return (
    <section
      aria-label={`${journey.name} live map`}
      className="journey-live-map"
      style={style}
    >
      <div
        className="journey-live-map-canvas"
        ref={containerRef}
      />
      <p className="sr-only">
        {model.routeLabel} has {model.services.length} active services.
      </p>
      {!MAPTILER_API_KEY ? (
        <div className="journey-live-map-fallback" aria-hidden="true" />
      ) : null}
      <div className="journey-live-map-attribution">
        <a href="https://www.maptiler.com/" rel="noreferrer" target="_blank">
          © MapTiler
        </a>
        <span>© OpenStreetMap contributors</span>
      </div>
    </section>
  );
}
