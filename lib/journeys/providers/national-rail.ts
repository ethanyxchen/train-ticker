import { searchNationalRailStations } from "../../data/national-rail-stations";
import {
  dedupeText,
  delayMinutes,
  fetchJson,
  formatBoardValue,
  normalizeEnvValue,
} from "../provider-utils";
import { JOURNEY_BOARD_ROW_COUNT } from "../constants";
import type { JourneyProvider } from "./base";
import { loadRailDisruptionContext } from "./national-rail-disruptions";
import { buildRailRequestUrl } from "./national-rail-request";
import type {
  BoardField,
  JourneySnapshot,
  JourneySnapshotStatus,
  SavedJourney,
  JourneyOption,
} from "../types";

interface DarwinMessage {
  Value?: string;
}

interface DarwinServiceLocation {
  locationName?: string;
  crs?: string;
}

interface DarwinCallingPoint {
  locationName?: string;
  crs?: string;
  st?: string;
  et?: string;
  at?: string;
  isCancelled?: boolean;
  delayReason?: string;
  cancelReason?: string;
}

interface DarwinCallingPointGroup {
  callingPoint?: DarwinCallingPoint[];
}

interface DarwinService {
  sta?: string;
  eta?: string;
  std?: string;
  etd?: string;
  platform?: string;
  operator?: string;
  operatorCode?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  adhocAlerts?: string[];
  destination?: DarwinServiceLocation[];
  subsequentCallingPoints?: DarwinCallingPointGroup[];
  serviceID?: string;
}

interface DarwinStationBoard {
  generatedAt?: string;
  locationName?: string;
  filterLocationName?: string;
  trainServices?: DarwinService[];
  busServices?: DarwinService[];
  ferryServices?: DarwinService[];
  nrccMessages?: DarwinMessage[];
}

type RailProxyAuthType = "api-key" | "bearer";

type RailConnection = {
  kind: "rdm-proxy";
  authType: RailProxyAuthType;
  proxyUrl: string;
  consumerKey: string;
};

interface RailBoardLoadResult {
  filteredBoards: DarwinStationBoard[];
  unfilteredBoards: DarwinStationBoard[];
}

function getRailConnection(): RailConnection | null {
  const proxyUrl = normalizeEnvValue(process.env.DARWIN_RDM_PROXY_URL);
  const consumerKey = normalizeEnvValue(process.env.DARWIN_RDM_CONSUMER_KEY);
  const authType =
    normalizeEnvValue(process.env.DARWIN_RDM_AUTH_TYPE)?.toLowerCase() === "bearer"
      ? "bearer"
      : "api-key";

  if (proxyUrl && consumerKey) {
    return {
      kind: "rdm-proxy",
      authType,
      proxyUrl,
      consumerKey,
    };
  }

  return null;
}

function buildRailHeaders(connection: RailConnection): Record<string, string> {
  return connection.authType === "bearer"
    ? {
        Authorization: `Bearer ${connection.consumerKey}`,
      }
    : {
        "x-apikey": connection.consumerKey,
      };
}

function buildUnconfiguredSnapshot(journey: SavedJourney): JourneySnapshot {
  const hasProxyKey = Boolean(normalizeEnvValue(process.env.DARWIN_RDM_CONSUMER_KEY));
  const missingProxyUrl = hasProxyKey && !normalizeEnvValue(process.env.DARWIN_RDM_PROXY_URL);
  const subheadline = missingProxyUrl
    ? "Add DARWIN_RDM_PROXY_URL from the Rail Data Marketplace Specification tab."
    : "Add DARWIN_RDM_PROXY_URL and DARWIN_RDM_CONSUMER_KEY to enable live National Rail departures.";
  const alerts = ["National Rail live boards use the Rail Data Marketplace proxy URL and consumer key."];

  return {
    journeyId: journey.id,
    provider: "national-rail",
    status: "unconfigured",
    headline: "Darwin credentials required",
    subheadline,
    refreshedAt: new Date().toISOString(),
    boardFields: [
      { label: "FROM", value: journey.origin.id },
      { label: "TO", value: journey.destination.id },
      { label: "STATE", value: "SET UP", tone: "warn" },
    ],
    options: [],
    alerts,
  };
}

function getServiceCallingPoints(service?: DarwinService): DarwinCallingPoint[] {
  return service?.subsequentCallingPoints?.flatMap((group) => group.callingPoint ?? []) ?? [];
}

function findJourneyCallingPoint(
  service: DarwinService | undefined,
  journey: SavedJourney,
): DarwinCallingPoint | undefined {
  const destinationId = journey.destination.id.toUpperCase();

  return getServiceCallingPoints(service).find(
    (callingPoint) => callingPoint.crs?.toUpperCase() === destinationId,
  );
}

function serviceMatchesJourney(
  service: DarwinService | undefined,
  journey: SavedJourney,
): boolean {
  if (!service) {
    return false;
  }

  if (findJourneyCallingPoint(service, journey)) {
    return true;
  }

  const destinationId = journey.destination.id.toUpperCase();

  return (
    service.destination?.some(
      (location) => location.crs?.toUpperCase() === destinationId,
    ) ?? false
  );
}

function getJourneyArrival(
  service: DarwinService | undefined,
  journey: SavedJourney,
): {
  scheduled?: string;
  expected?: string;
  callingPoint?: DarwinCallingPoint;
} {
  const callingPoint = findJourneyCallingPoint(service, journey);

  if (callingPoint) {
    return {
      scheduled: callingPoint.st,
      expected: callingPoint.at ?? callingPoint.et,
      callingPoint,
    };
  }

  return {
    scheduled: service?.sta,
    expected: service?.eta,
  };
}

function pickRailStatus(
  service?: DarwinService,
  arrival?: { scheduled?: string; expected?: string; callingPoint?: DarwinCallingPoint },
): JourneySnapshotStatus {
  if (!service) {
    return "warning";
  }

  if (
    service.isCancelled ||
    service.etd?.toLowerCase() === "cancelled" ||
    arrival?.callingPoint?.isCancelled
  ) {
    return "error";
  }

  const delay = delayMinutes(
    arrival?.scheduled ?? service.std,
    arrival?.expected ?? service.etd,
  );

  if (delay !== null && delay > 0) {
    return "warning";
  }

  if (
    arrival?.expected &&
    arrival.expected !== "On time" &&
    arrival.expected !== arrival.scheduled &&
    !/^\d{2}:\d{2}$/.test(arrival.expected)
  ) {
    return "warning";
  }

  return "ok";
}

function buildRailHeadline(
  service: DarwinService | undefined,
  arrival: { scheduled?: string; expected?: string; callingPoint?: DarwinCallingPoint },
): string {
  if (!service) {
    return "No matching departures found";
  }

  if (
    service.isCancelled ||
    service.etd?.toLowerCase() === "cancelled" ||
    arrival.callingPoint?.isCancelled
  ) {
    return "Next matching service cancelled";
  }

  const delay = delayMinutes(
    arrival.scheduled ?? service.std,
    arrival.expected ?? service.etd,
  );

  if (delay !== null && delay > 0) {
    return `${delay} minute delay on next matching service`;
  }

  if (
    arrival.expected === "On time" ||
    arrival.expected === arrival.scheduled ||
    (!arrival.expected && (service.etd === "On time" || service.etd === service.std))
  ) {
    return "Next matching service on time";
  }

  if (arrival.expected) {
    return `Next matching service expected ${arrival.expected}`;
  }

  if (service.etd) {
    return `Next matching service expected ${service.etd}`;
  }

  return "Next matching service found";
}

function buildRailFields(
  service: DarwinService | undefined,
  arrival: { scheduled?: string; expected?: string; callingPoint?: DarwinCallingPoint },
): BoardField[] {
  return [
    {
      label: "DEP",
      value: formatBoardValue(service?.std),
      tone: "neutral",
    },
    {
      label: "LIVE",
      value: formatBoardValue(service?.etd, "BOARD"),
      tone: pickRailStatus(service, arrival) === "ok" ? "good" : "warn",
    },
    {
      label: "ARR",
      value: formatBoardValue(arrival.expected ?? arrival.scheduled),
      tone: "neutral",
    },
    {
      label: "PLAT",
      value: formatBoardValue(service?.platform),
      tone: "neutral",
    },
    {
      label: "OPER",
      value: formatBoardValue(service?.operator),
      tone: "neutral",
    },
  ];
}

function buildNoServiceRailFields(
  liveValue: string,
  liveTone: BoardField["tone"],
): BoardField[] {
  return [
    {
      label: "DEP",
      value: "--:--",
      tone: "neutral",
    },
    {
      label: "LIVE",
      value: liveValue,
      tone: liveTone,
    },
    {
      label: "ARR",
      value: "--:--",
      tone: "neutral",
    },
    {
      label: "PLAT",
      value: "--",
      tone: "neutral",
    },
    {
      label: "OPER",
      value: "--",
      tone: "neutral",
    },
  ];
}

function getBoardServices(board: DarwinStationBoard): DarwinService[] {
  return [
    ...(board.trainServices ?? []),
    ...(board.busServices ?? []),
    ...(board.ferryServices ?? []),
  ];
}

function parseRailClockMinutes(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function normalizeRailClockMinutes(
  value: number | null,
  anchor: number | null,
): number | null {
  if (value === null || anchor === null) {
    return value;
  }

  return value < anchor - 12 * 60 ? value + 24 * 60 : value;
}

function compareRailClockMinutes(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function collectMatchingRailServices(
  boardGroups: DarwinStationBoard[][],
  journey: SavedJourney,
): DarwinService[] {
  const candidates = boardGroups.flatMap((boards, sourceIndex) =>
    boards.flatMap((board, batchIndex) => {
      const anchor = parseRailClockMinutes(getBoardServices(board)[0]?.std);

      return getBoardServices(board)
        .filter((service) => serviceMatchesJourney(service, journey))
        .map((service, serviceIndex) => ({
          service,
          batchIndex,
          sourceIndex,
          serviceIndex,
          departureMinutes: normalizeRailClockMinutes(
            parseRailClockMinutes(service.std),
            anchor,
          ),
        }));
    }),
  );

  return dedupeRailServices(
    candidates
      .sort(
        (left, right) =>
          left.batchIndex - right.batchIndex ||
          compareRailClockMinutes(left.departureMinutes, right.departureMinutes) ||
          left.sourceIndex - right.sourceIndex ||
          left.serviceIndex - right.serviceIndex,
      )
      .map((candidate) => candidate.service),
  );
}

function parseClockToMinutes(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isServiceWithinWindow(
  service: DarwinService,
  now: Date,
  timeWindowHours: number,
) {
  const stdMinutes = parseClockToMinutes(service.std);

  if (stdMinutes === null) {
    return true;
  }

  const start = new Date(now);
  start.setUTCSeconds(0, 0);
  const departure = new Date(start);
  departure.setUTCHours(0, 0, 0, 0);
  departure.setUTCMinutes(stdMinutes);

  if (departure.getTime() < start.getTime()) {
    departure.setUTCDate(departure.getUTCDate() + 1);
  }

  const end = new Date(start);
  end.setTime(start.getTime() + timeWindowHours * 60 * 60 * 1000);

  return departure.getTime() <= end.getTime();
}

function buildLiveJourneyOption(
  journey: SavedJourney,
  service: DarwinService,
  index: number,
): JourneyOption {
  const callingPoints = service?.subsequentCallingPoints?.[0]?.callingPoint ?? [];
  const destinationName =
    findJourneyCallingPoint(service, journey)?.locationName ??
    service?.destination?.[0]?.locationName ??
    journey.destination.label;
  const arrival = getJourneyArrival(service, journey);

  return {
    id: service?.serviceID ?? `${journey.id}-${index}`,
    title: destinationName,
    scheduledDeparture: service?.std,
    expectedDeparture: service?.etd,
    scheduledArrival: arrival.scheduled,
    expectedArrival: arrival.expected,
    platform: service?.platform,
    operator: service?.operator,
    operatorCode: service?.operatorCode,
    note:
      callingPoints.length > 0
        ? `Calling at ${callingPoints
            .slice(0, 3)
            .map((callingPoint) => callingPoint.locationName)
            .filter(Boolean)
            .join(", ")}`
        : undefined,
  };
}

function getOptionMergeKey(option: JourneyOption): string {
  return [
    option.scheduledDeparture ?? "",
    option.scheduledArrival ?? "",
    option.operatorCode ?? option.operator ?? "",
    option.title ?? "",
  ]
    .map((value) => value.trim().toUpperCase())
    .join("|");
}

function compareOptionTimes(left: JourneyOption, right: JourneyOption): number {
  return compareRailClockMinutes(
    parseRailClockMinutes(left.scheduledDeparture ?? left.expectedDeparture),
    parseRailClockMinutes(right.scheduledDeparture ?? right.expectedDeparture),
  );
}

function mergeRailOptions(
  liveOptions: JourneyOption[],
  scheduledOptions: JourneyOption[],
): JourneyOption[] {
  const scheduledByKey = new Map<string, JourneyOption>();

  for (const option of scheduledOptions) {
    scheduledByKey.set(getOptionMergeKey(option), option);
  }

  for (const liveOption of liveOptions) {
    const key = getOptionMergeKey(liveOption);
    const scheduledOption = scheduledByKey.get(key);

    if (!scheduledOption) {
      scheduledByKey.set(key, liveOption);
      continue;
    }

    scheduledByKey.set(key, {
      ...scheduledOption,
      ...liveOption,
      scheduledDeparture:
        liveOption.scheduledDeparture ?? scheduledOption.scheduledDeparture,
      scheduledArrival: liveOption.scheduledArrival ?? scheduledOption.scheduledArrival,
    });
  }

  return Array.from(scheduledByKey.values())
    .sort(compareOptionTimes)
    .slice(0, JOURNEY_BOARD_ROW_COUNT);
}

async function loadRailBoards(
  journey: SavedJourney,
  connection: RailConnection,
  params?: {
    filterDestination?: boolean;
    timeWindowMinutes?: number;
  },
): Promise<DarwinStationBoard[]> {
  const boards: DarwinStationBoard[] = [];

  for (const timeOffset of [0, 60, 90]) {
    const requestUrl = buildRailRequestUrl(journey, connection, {
      filterDestination: params?.filterDestination,
      timeOffset,
      timeWindow: params?.timeWindowMinutes ?? 60,
      numRows: 20,
    });
    const board = await fetchJson<DarwinStationBoard>(requestUrl, {
      headers: buildRailHeaders(connection),
    });
    boards.push(board);

    const matches = getBoardServices(board).filter((service) =>
      serviceMatchesJourney(service, journey),
    );

    if (matches.length >= JOURNEY_BOARD_ROW_COUNT) {
      break;
    }
  }

  return boards;
}

async function loadBestRailBoards(
  journey: SavedJourney,
  connection: RailConnection,
  timeWindowMinutes: number,
): Promise<RailBoardLoadResult> {
  const [filteredBoards, unfilteredBoards] = await Promise.all([
    loadRailBoards(journey, connection, { timeWindowMinutes }),
    loadRailBoards(journey, connection, {
      filterDestination: false,
      timeWindowMinutes,
    }),
  ]);

  return {
    filteredBoards,
    unfilteredBoards,
  };
}

function dedupeRailServices(services: DarwinService[]): DarwinService[] {
  const seen = new Set<string>();

  return services.filter((service) => {
    const key = service.serviceID ?? `${service.std ?? ""}-${service.etd ?? ""}-${service.destination?.[0]?.crs ?? ""}-${service.operator ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export const nationalRailProvider: JourneyProvider = {
  id: "national-rail",
  async search(query) {
    return searchNationalRailStations(query);
  },
  async getSnapshot(journey, context) {
    const connection = getRailConnection();
    const timeWindowHours = Math.min(
      Math.max(Math.floor(context?.timeWindowHours ?? 1), 1),
      6,
    );
    const timeWindowMinutes = timeWindowHours * 60;

    if (!connection) {
      return buildUnconfiguredSnapshot(journey);
    }

    const boardLoadResult = await loadBestRailBoards(
      journey,
      connection,
      timeWindowMinutes,
    );
    const boards = [
      ...boardLoadResult.filteredBoards,
      ...boardLoadResult.unfilteredBoards,
    ];
    const board = boards[0];
    const boardNow =
      (board?.generatedAt ? new Date(board.generatedAt) : null) ?? new Date();
    const effectiveNow = Number.isNaN(boardNow.getTime()) ? new Date() : boardNow;
    const departures = collectMatchingRailServices(
      [boardLoadResult.unfilteredBoards, boardLoadResult.filteredBoards],
      journey,
    )
      .filter((service) => isServiceWithinWindow(service, effectiveNow, timeWindowHours))
      .slice(0, JOURNEY_BOARD_ROW_COUNT);
    const firstService = departures[0];
    const firstArrival = getJourneyArrival(firstService, journey);
    const disruptionContext = await loadRailDisruptionContext(
      journey,
      dedupeText(
        departures.map((service) => service.operatorCode?.toUpperCase()),
      ),
    );
    const status =
      departures.length === 0 && disruptionContext?.fallback
        ? disruptionContext.fallback.status
        : pickRailStatus(firstService, firstArrival);

    const liveOptions = departures.map((service, index) =>
      buildLiveJourneyOption(journey, service, index),
    );
    const mergedOptions = mergeRailOptions(
      liveOptions,
      context?.scheduledOptions ?? [],
    );
    const mergedFirstOption = mergedOptions[0];

    const alerts = dedupeText([
      ...boards.flatMap((currentBoard) =>
        (currentBoard.nrccMessages ?? []).map((message) => message.Value),
      ),
      firstService?.cancelReason,
      firstService?.delayReason,
      firstArrival.callingPoint?.cancelReason,
      firstArrival.callingPoint?.delayReason,
      ...(firstService?.adhocAlerts ?? []),
      departures.length === 0
        ? "No services to the selected stop were visible in the current live departure-board window."
        : undefined,
      ...(disruptionContext?.alerts ?? []),
      context?.scheduledOptions?.length
        ? `Showing departures within next ${timeWindowHours} hour${timeWindowHours === 1 ? "" : "s"}.`
        : undefined,
    ]);

    return {
      journeyId: journey.id,
      provider: "national-rail",
      status,
      headline:
        departures.length === 0 && disruptionContext?.fallback
          ? disruptionContext.fallback.headline
          : mergedOptions.length > 0 && !firstService
            ? "Scheduled departures loaded"
            : buildRailHeadline(firstService, firstArrival),
      subheadline:
        departures.length === 0 && disruptionContext?.fallback
          ? disruptionContext.fallback.subheadline
          : mergedOptions.length > 0
            ? `${board.locationName ?? journey.origin.label} to ${journey.destination.label}`
            : `No live departures were returned for ${journey.origin.label} to ${journey.destination.label} in the current board window.`,
      refreshedAt:
        disruptionContext?.refreshedAt ??
        board.generatedAt ??
        new Date().toISOString(),
      boardFields: !mergedFirstOption
        ? buildNoServiceRailFields(
            disruptionContext?.fallback?.liveValue ?? "NO SERVICE",
            disruptionContext?.fallback?.liveTone ?? "warn",
          )
        : departures.length === 0
          ? buildNoServiceRailFields(
              mergedFirstOption.scheduledDeparture ?? "SCHEDULED",
              "neutral",
            )
          : buildRailFields(firstService, firstArrival),
      options: mergedOptions,
      alerts,
    };
  },
};
