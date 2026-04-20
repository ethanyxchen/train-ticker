import {
  appendSearchParams,
  dedupeText,
  fetchJson,
  normalizeEnvValue,
  stripHtml,
} from "../provider-utils";
import type {
  JourneySnapshotStatus,
  JourneySnapshotTone,
  SavedJourney,
} from "../types";

interface RailDisruptionsConnection {
  baseUrl: string;
  consumerKey: string;
  userAgent: string;
}

interface RailOperator {
  tocCode?: string;
  tocName?: string;
}

interface RailRoute {
  routeDetails?: string;
  lineOfRoute?: string;
}

interface RailDisruptionLink {
  uri?: string;
  label?: string;
}

interface RailDisruption {
  source?: string;
  id?: string;
  version?: string;
  summary?: string;
  description?: string;
  status?: string;
  severity?: string;
  category?: string;
  isAlert?: boolean;
  isServiceDisruption?: boolean;
  isPlanned?: boolean;
  isCleared?: boolean;
  affectedOperators?: RailOperator[];
  affectedRoutes?: RailRoute[];
  disruptionLinks?: RailDisruptionLink[];
  startDateTime?: string;
  expiryDateTime?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  creationTime?: string;
}

interface RailDisruptionsByStation {
  crsCode?: string;
  disruptions?: RailDisruption[];
  stationAlerts?: string;
}

interface RailStationDisruption {
  source?: string;
  category?: string;
  severity?: string;
  message?: string;
  description?: string;
}

interface RailStationMessagesByStation {
  crsCode?: string;
  creationTime?: string;
  stationDisruptions?: RailStationDisruption[];
  stationAlerts?: string;
}

interface RailServiceGroup {
  name?: string;
  currentDisruption?: string;
  customDetail?: string;
  customURL?: string;
}

interface RailServiceIndicator {
  tocCode?: string;
  tocName?: string;
  tocStatus?: string;
  tocStatusDescription?: string;
  tocAdditionalInfo?: string;
  tocCustomAdditionalInfo?: string;
  tocServiceGroup?: RailServiceGroup[];
}

interface NormalizedDisruption {
  headline: string;
  detail?: string;
  tone: JourneySnapshotTone;
  status: JourneySnapshotStatus;
  priority: number;
  serviceImpact: boolean;
  timestamp?: string;
  tocCodes: string[];
}

interface RailStationSnapshot {
  crsCode: string;
  disruptions: RailDisruption[];
  stationDisruptions: RailStationDisruption[];
  stationAlerts: string[];
  refreshedAt?: string;
}

export interface RailDisruptionContext {
  alerts: string[];
  refreshedAt?: string;
  fallback?: {
    headline: string;
    subheadline: string;
    status: JourneySnapshotStatus;
    liveValue: string;
    liveTone: JourneySnapshotTone;
  };
}

const DISRUPTION_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_USER_AGENT = "TrainTicker/0.1";
const disruptionCache = new Map<
  string,
  { expiresAt: number; value: RailDisruptionContext | null }
>();

function normalizeDisruptionsBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return /\/api\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/api/v2`;
}

function getRailDisruptionsConnection(): RailDisruptionsConnection | null {
  const baseUrl = normalizeEnvValue(process.env.RDG_DISRUPTIONS_BASE_URL);
  const consumerKey = normalizeEnvValue(process.env.RDG_DISRUPTIONS_CONSUMER_KEY);
  const userAgent =
    normalizeEnvValue(process.env.RDG_DISRUPTIONS_USER_AGENT) ?? DEFAULT_USER_AGENT;

  if (!baseUrl || !consumerKey) {
    return null;
  }

  return {
    baseUrl: normalizeDisruptionsBaseUrl(baseUrl),
    consumerKey,
    userAgent,
  };
}

function buildDisruptionsHeaders(
  connection: RailDisruptionsConnection,
): Record<string, string> {
  return {
    "x-apikey": connection.consumerKey,
    "User-Agent": connection.userAgent,
    "Accept-Encoding": "gzip",
  };
}

function buildDisruptionsUrl(
  connection: RailDisruptionsConnection,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): string {
  return appendSearchParams(`${connection.baseUrl}${path}`, params);
}

async function fetchDisruptionsResource<T>(
  connection: RailDisruptionsConnection,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  return fetchJson<T>(buildDisruptionsUrl(connection, path, params), {
    headers: buildDisruptionsHeaders(connection),
  });
}

async function tryFetchDisruptionsResource<T>(
  connection: RailDisruptionsConnection,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T | null> {
  try {
    return await fetchDisruptionsResource<T>(connection, path, params);
  } catch {
    return null;
  }
}

function collectStationCodes(journey: SavedJourney): string[] {
  return dedupeText([
    journey.origin.id.toUpperCase(),
    journey.destination.id.toUpperCase(),
  ]);
}

function getCacheKey(journey: SavedJourney, operatorCodes: string[]): string {
  return [
    journey.origin.id.toUpperCase(),
    journey.destination.id.toUpperCase(),
    ...operatorCodes.map((code) => code.toUpperCase()).sort(),
  ].join("|");
}

function dedupeCanonicalDisruptions(disruptions: RailDisruption[]): RailDisruption[] {
  const seen = new Set<string>();

  return disruptions.filter((disruption) => {
    const key = [
      disruption.source,
      disruption.id,
      disruption.version,
      disruption.summary,
      disruption.description,
      disruption.createdDateTime,
      disruption.creationTime,
    ]
      .filter(Boolean)
      .join("|");

    if (!key) {
      return false;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStationDisruptions(
  disruptions: RailStationDisruption[],
): RailStationDisruption[] {
  const seen = new Set<string>();

  return disruptions.filter((disruption) => {
    const key = [
      disruption.source,
      disruption.category,
      disruption.severity,
      disruption.message,
      disruption.description,
    ]
      .filter(Boolean)
      .join("|");

    if (!key) {
      return false;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toStationMap<T extends { crsCode?: string }>(items: T[]): Map<string, T> {
  return new Map(
    items
      .map((item) => [item.crsCode?.toUpperCase(), item] as const)
      .filter((entry): entry is readonly [string, T] => Boolean(entry[0])),
  );
}

function isStationRecordEmpty(record?: RailDisruptionsByStation): boolean {
  return !record || (!(record.disruptions?.length) && !normalizeEnvValue(record.stationAlerts));
}

async function loadStationSnapshots(
  journey: SavedJourney,
  connection: RailDisruptionsConnection,
  forceSupplement: boolean,
): Promise<RailStationSnapshot[]> {
  const stationCodes = collectStationCodes(journey);
  const stationParam = stationCodes.join(",");
  const allDisruptions =
    (await tryFetchDisruptionsResource<RailDisruptionsByStation[]>(
      connection,
      "/stations/disruptions",
      { crsCode: stationParam },
    )) ?? [];
  const allDisruptionsByCode = toStationMap(allDisruptions);
  const needsSupplement =
    forceSupplement ||
    stationCodes.some((code) => isStationRecordEmpty(allDisruptionsByCode.get(code)));
  let incidentsByCode = new Map<string, RailDisruptionsByStation>();
  let stationMessagesByCode = new Map<string, RailStationMessagesByStation>();

  if (needsSupplement) {
    const [incidents, stationMessages] = await Promise.all([
      tryFetchDisruptionsResource<RailDisruptionsByStation[]>(
        connection,
        "/stations/disruptions/incidents",
        { crsCode: stationParam },
      ),
      tryFetchDisruptionsResource<RailStationMessagesByStation[]>(
        connection,
        "/stations/disruptions/stationMessages",
        { crsCode: stationParam },
      ),
    ]);

    incidentsByCode = toStationMap(incidents ?? []);
    stationMessagesByCode = toStationMap(stationMessages ?? []);
  }

  return stationCodes.map((crsCode) => {
    const allDisruptionRecord = allDisruptionsByCode.get(crsCode);
    const incidentRecord = incidentsByCode.get(crsCode);
    const stationMessagesRecord = stationMessagesByCode.get(crsCode);

    return {
      crsCode,
      disruptions: dedupeCanonicalDisruptions([
        ...(allDisruptionRecord?.disruptions ?? []),
        ...(incidentRecord?.disruptions ?? []),
      ]),
      stationDisruptions: dedupeStationDisruptions(
        stationMessagesRecord?.stationDisruptions ?? [],
      ),
      stationAlerts: dedupeText([
        allDisruptionRecord?.stationAlerts,
        stationMessagesRecord?.stationAlerts,
      ]),
      refreshedAt: [
        ...dedupeText(
          [
            ...dedupeCanonicalDisruptions([
              ...(allDisruptionRecord?.disruptions ?? []),
              ...(incidentRecord?.disruptions ?? []),
            ]).flatMap((disruption) => [
              disruption.lastModifiedDateTime,
              disruption.createdDateTime,
              disruption.startDateTime,
              disruption.creationTime,
            ]),
            stationMessagesRecord?.creationTime,
          ].filter(Boolean),
        ),
      ]
        .sort()
        .at(-1),
    };
  });
}

function normalizeText(value?: string | null): string | undefined {
  const text = stripHtml(value);
  return text || undefined;
}

function toneRank(tone: JourneySnapshotTone): number {
  switch (tone) {
    case "bad":
      return 3;
    case "warn":
      return 2;
    case "neutral":
      return 1;
    case "good":
      return 0;
  }
}

function inferTone(
  values: Array<string | undefined>,
  severity?: string,
  category?: string,
): JourneySnapshotTone {
  const severityText = [severity, category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const text = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(p0|p1|major|severe|high|closed|suspend|cancel|do not travel|not run|blocked)\b/.test(
      `${severityText} ${text}`,
    )
  ) {
    return "bad";
  }

  if (
    /\b(p2|minor|low|delay|disrupt|engineering|replacement|altered|amended|revised|planned|problem|alert)\b/.test(
      `${severityText} ${text}`,
    )
  ) {
    return "warn";
  }

  return "neutral";
}

function inferStatus(tone: JourneySnapshotTone): JourneySnapshotStatus {
  return tone === "bad" ? "error" : "warning";
}

function hasServiceImpact(values: Array<string | undefined>, category?: string): boolean {
  const text = [...values, category].filter(Boolean).join(" ").toLowerCase();

  return /\b(delay|cancel|disrupt|engineering|replacement|altered|amended|revised|suspend|closed|not run|do not travel|service|bus)\b/.test(
    text,
  );
}

function joinAlertParts(headline?: string, detail?: string): string {
  return dedupeText([headline, detail]).join(" · ");
}

function compareDisruptions(
  left: NormalizedDisruption,
  right: NormalizedDisruption,
): number {
  return (
    right.priority - left.priority ||
    toneRank(right.tone) - toneRank(left.tone) ||
    (right.timestamp ?? "").localeCompare(left.timestamp ?? "")
  );
}

function normalizeCanonicalDisruption(
  disruption: RailDisruption,
): NormalizedDisruption | null {
  if (disruption.isCleared || disruption.status === "Cleared") {
    return null;
  }

  const headline =
    normalizeText(disruption.summary) ?? normalizeText(disruption.description);

  if (!headline) {
    return null;
  }

  const detail =
    normalizeText(disruption.affectedRoutes?.[0]?.routeDetails) ??
    normalizeText(disruption.affectedRoutes?.[0]?.lineOfRoute) ??
    normalizeText(disruption.disruptionLinks?.[0]?.label);
  const tone = inferTone(
    [headline, detail],
    disruption.severity,
    disruption.category,
  );
  const serviceImpact =
    Boolean(disruption.isServiceDisruption) ||
    disruption.source === "knowledgebase_incident" ||
    hasServiceImpact([headline, detail], disruption.category);

  return {
    headline,
    detail,
    tone,
    status: inferStatus(tone),
    priority:
      toneRank(tone) * 10 +
      (disruption.source === "knowledgebase_incident"
        ? 3
        : disruption.source === "iptis_bulletin"
          ? 2
          : 1),
    serviceImpact,
    timestamp:
      disruption.lastModifiedDateTime ??
      disruption.createdDateTime ??
      disruption.startDateTime ??
      disruption.creationTime,
    tocCodes: dedupeText(
      (disruption.affectedOperators ?? []).map((operator) =>
        operator.tocCode?.toUpperCase(),
      ),
    ),
  };
}

function normalizeStationDisruption(
  disruption: RailStationDisruption,
): NormalizedDisruption | null {
  const headline =
    normalizeText(disruption.message) ?? normalizeText(disruption.description);

  if (!headline) {
    return null;
  }

  const detail =
    normalizeText(disruption.description) &&
    normalizeText(disruption.description) !== headline
      ? normalizeText(disruption.description)
      : undefined;
  const tone = inferTone(
    [headline, detail],
    disruption.severity,
    disruption.category,
  );

  return {
    headline,
    detail,
    tone,
    status: inferStatus(tone),
    priority: toneRank(tone) * 10 + 1,
    serviceImpact: hasServiceImpact([headline, detail], disruption.category),
    tocCodes: [],
  };
}

function normalizeStationAlert(alert: string): NormalizedDisruption | null {
  const headline = normalizeText(alert);

  if (!headline) {
    return null;
  }

  const tone = inferTone([headline]);

  return {
    headline,
    tone,
    status: inferStatus(tone),
    priority: toneRank(tone),
    serviceImpact: hasServiceImpact([headline]),
    tocCodes: [],
  };
}

function isGoodServiceIndicator(indicator: RailServiceIndicator): boolean {
  const statusText = [
    indicator.tocStatus,
    indicator.tocStatusDescription,
    indicator.tocAdditionalInfo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /good service/.test(statusText)
    ? !(indicator.tocServiceGroup ?? []).some((group) =>
        normalizeText(group.currentDisruption ?? group.customDetail),
      )
    : false;
}

function normalizeServiceIndicator(
  indicator: RailServiceIndicator,
): NormalizedDisruption | null {
  if (isGoodServiceIndicator(indicator)) {
    return null;
  }

  const serviceGroupDetail = dedupeText(
    (indicator.tocServiceGroup ?? []).flatMap((group) => [
      normalizeText(group.currentDisruption),
      normalizeText(group.customDetail),
    ]),
  )[0];
  const description =
    normalizeText(indicator.tocStatusDescription) ??
    normalizeText(indicator.tocAdditionalInfo) ??
    normalizeText(indicator.tocCustomAdditionalInfo);
  const headline = dedupeText([
    indicator.tocName ?? indicator.tocCode,
    description ?? indicator.tocStatus,
  ]).join(": ");

  if (!headline) {
    return null;
  }

  const tone = inferTone(
    [headline, serviceGroupDetail],
    indicator.tocStatus,
    indicator.tocStatusDescription,
  );

  return {
    headline,
    detail: serviceGroupDetail,
    tone,
    status: inferStatus(tone),
    priority: toneRank(tone) * 10 + 2,
    serviceImpact: true,
    tocCodes: dedupeText([indicator.tocCode?.toUpperCase()]),
  };
}

async function loadServiceIndicators(
  connection: RailDisruptionsConnection,
  tocCodes: string[],
): Promise<RailServiceIndicator[]> {
  const uniqueCodes = dedupeText(tocCodes.map((code) => code.toUpperCase())).slice(0, 10);

  if (uniqueCodes.length === 0) {
    return [];
  }

  const results = await Promise.all(
    uniqueCodes.map((tocCode) =>
      tryFetchDisruptionsResource<RailServiceIndicator>(
        connection,
        `/tocs/${tocCode}/serviceIndicators`,
      ),
    ),
  );

  return results.filter(
    (result): result is RailServiceIndicator => result !== null,
  );
}

function getLatestTimestamp(items: NormalizedDisruption[]): string | undefined {
  return items
    .map((item) => item.timestamp)
    .filter(Boolean)
    .sort()
    .at(-1);
}

function buildFallback(
  journey: SavedJourney,
  items: NormalizedDisruption[],
): RailDisruptionContext["fallback"] | undefined {
  const primary = [...items]
    .filter((item) => item.serviceImpact)
    .sort(compareDisruptions)[0];

  if (!primary) {
    return undefined;
  }

  return {
    headline: primary.headline,
    subheadline:
      primary.detail ??
      `Disruption affecting ${journey.origin.label} to ${journey.destination.label}`,
    status: primary.status,
    liveValue: primary.tone === "bad" ? "ALERT" : "CHECK",
    liveTone: primary.tone === "neutral" ? "warn" : primary.tone,
  };
}

async function loadRailDisruptionContextUncached(
  journey: SavedJourney,
  operatorCodes: string[],
  connection: RailDisruptionsConnection,
): Promise<RailDisruptionContext | null> {
  const stationSnapshots = await loadStationSnapshots(
    journey,
    connection,
    operatorCodes.length === 0,
  );
  const disruptionItems = stationSnapshots.flatMap((stationSnapshot) => [
    ...stationSnapshot.disruptions
      .map(normalizeCanonicalDisruption)
      .filter(
        (item): item is NormalizedDisruption => item !== null,
      ),
    ...stationSnapshot.stationDisruptions
      .map(normalizeStationDisruption)
      .filter(
        (item): item is NormalizedDisruption => item !== null,
      ),
    ...stationSnapshot.stationAlerts
      .map(normalizeStationAlert)
      .filter(
        (item): item is NormalizedDisruption => item !== null,
      ),
  ]);
  const serviceIndicatorCodes = dedupeText([
    ...operatorCodes.map((operatorCode) => operatorCode.toUpperCase()),
    ...disruptionItems.flatMap((item) => item.tocCodes),
  ]);
  const serviceIndicators = await loadServiceIndicators(connection, serviceIndicatorCodes);
  const normalizedItems = [
    ...disruptionItems,
    ...serviceIndicators
      .map(normalizeServiceIndicator)
      .filter(
        (item): item is NormalizedDisruption => item !== null,
      ),
  ].sort(compareDisruptions);

  if (normalizedItems.length === 0) {
    return null;
  }

  return {
    alerts: dedupeText(
      normalizedItems.map((item) => joinAlertParts(item.headline, item.detail)),
    ),
    refreshedAt:
      getLatestTimestamp(normalizedItems) ??
      stationSnapshots
        .map((snapshot) => snapshot.refreshedAt)
        .filter(Boolean)
        .sort()
        .at(-1),
    fallback: buildFallback(journey, normalizedItems),
  };
}

export async function loadRailDisruptionContext(
  journey: SavedJourney,
  operatorCodes: string[],
): Promise<RailDisruptionContext | null> {
  const connection = getRailDisruptionsConnection();

  if (!connection) {
    return null;
  }

  const cacheKey = `${connection.baseUrl}|${getCacheKey(journey, operatorCodes)}`;
  const cached = disruptionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await loadRailDisruptionContextUncached(
    journey,
    operatorCodes,
    connection,
  ).catch(() => null);

  disruptionCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + DISRUPTION_CACHE_TTL_MS,
  });

  return value;
}
