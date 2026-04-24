import { gunzipSync } from "node:zlib";

import { Storage } from "@google-cloud/storage";

import type { JourneyOption, SavedJourney } from "@/lib/journeys/types";
import { dedupeText, normalizeEnvValue } from "@/lib/journeys/provider-utils";

interface ParsedStop {
  crs?: string;
  arrival?: string;
  departure?: string;
  platform?: string;
}

interface ParsedJourney {
  rid?: string;
  toc?: string;
  ssd?: string;
  stops: ParsedStop[];
}

type ParsedRefMap = Map<string, string>;

const RUN_KEY_PATTERN = /^PPTimetable\/(\d{14})_[^/]+\.xml\.gz$/;
const FILE_NAME_PATTERN =
  /^PPTimetable\/(?<runKey>\d{14})_(?<kind>ref_)?v(?<version>\d+)\.xml\.gz$/;
const JOURNEY_PATTERN = /<Journey\b([^>]*)>([\s\S]*?)<\/Journey>/g;
const STOP_PATTERN = /<(OR|IP|DT|OPOR|OPIP|OPDT)\b([^>]*)\/>/g;
const LOCATION_REF_PATTERN = /<LocationRef\b([^>]*)\/>/g;
const ATTRIBUTE_PATTERN = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
const DEFAULT_PREFIX = "PPTimetable/";
const DEFAULT_MAX_WINDOW_HOURS = 6;

function decodeXmlValue(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of input.matchAll(ATTRIBUTE_PATTERN)) {
    attributes[match[1]] = decodeXmlValue(match[2]);
  }

  return attributes;
}

function getPPTimetableRunKey(name: string) {
  const match = RUN_KEY_PATTERN.exec(name);
  return match?.[1] ?? null;
}

function pickLatestRun(files: string[]) {
  let latestRun: string | null = null;

  for (const file of files) {
    const runKey = getPPTimetableRunKey(file);

    if (!runKey) {
      continue;
    }

    if (!latestRun || runKey > latestRun) {
      latestRun = runKey;
    }
  }

  return latestRun;
}

function pickLatestFilesForRun(files: string[], runKey: string) {
  let timetableName: string | null = null;
  let referenceName: string | null = null;
  let timetableVersion = -1;
  let referenceVersion = -1;

  for (const file of files) {
    const match = FILE_NAME_PATTERN.exec(file);

    if (!match || match.groups?.runKey !== runKey) {
      continue;
    }

    const version = Number.parseInt(match.groups.version, 10);
    const isReference = Boolean(match.groups.kind);

    if (isReference) {
      if (version > referenceVersion) {
        referenceVersion = version;
        referenceName = file;
      }
      continue;
    }

    if (version > timetableVersion) {
      timetableVersion = version;
      timetableName = file;
    }
  }

  return { timetableName, referenceName };
}

function parseReferenceMap(xml: string): ParsedRefMap {
  const map: ParsedRefMap = new Map();

  for (const match of xml.matchAll(LOCATION_REF_PATTERN)) {
    const attrs = parseAttributes(match[1]);
    const tpl = attrs.tpl?.toUpperCase();
    const crs = attrs.crs?.toUpperCase();

    if (!tpl || !crs) {
      continue;
    }

    map.set(tpl, crs);
  }

  return map;
}

function normalizeJourneyTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function parseJourneys(xml: string, refMap: ParsedRefMap): ParsedJourney[] {
  const journeys: ParsedJourney[] = [];

  for (const match of xml.matchAll(JOURNEY_PATTERN)) {
    const journeyAttributes = parseAttributes(match[1]);
    const rawStops = match[2];
    const stops: ParsedStop[] = [];

    for (const stopMatch of rawStops.matchAll(STOP_PATTERN)) {
      const stopAttributes = parseAttributes(stopMatch[2]);
      const tpl = stopAttributes.tpl?.toUpperCase();
      const crs = tpl ? refMap.get(tpl) : undefined;

      stops.push({
        crs,
        arrival: normalizeJourneyTime(stopAttributes.pta ?? stopAttributes.wta),
        departure: normalizeJourneyTime(stopAttributes.ptd ?? stopAttributes.wtd),
        platform: stopAttributes.plat?.trim() || undefined,
      });
    }

    if (stops.length === 0) {
      continue;
    }

    journeys.push({
      rid: journeyAttributes.rid,
      toc: journeyAttributes.toc,
      ssd: journeyAttributes.ssd,
      stops,
    });
  }

  return journeys;
}

function toIsoFromScheduleDate(
  serviceDate: string,
  hhmm: string,
): Date | null {
  const dateTime = new Date(`${serviceDate}T${hhmm}:00`);

  if (Number.isNaN(dateTime.getTime())) {
    return null;
  }

  return dateTime;
}

function getWindowEnd(start: Date, hours: number) {
  const end = new Date(start);
  end.setTime(start.getTime() + hours * 60 * 60 * 1000);
  return end;
}

function isWithinWindow(value: Date, start: Date, end: Date) {
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
}

function clampTimeWindowHours(hours: number | undefined) {
  if (!hours || !Number.isFinite(hours)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(hours), 1), DEFAULT_MAX_WINDOW_HOURS);
}

function parseClockMinutes(value: string | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function compareClock(left: string | undefined, right: string | undefined) {
  const leftMinutes = parseClockMinutes(left);
  const rightMinutes = parseClockMinutes(right);

  if (leftMinutes === null && rightMinutes === null) {
    return 0;
  }

  if (leftMinutes === null) {
    return 1;
  }

  if (rightMinutes === null) {
    return -1;
  }

  return leftMinutes - rightMinutes;
}

function toOperatorCode(toc: string | undefined) {
  const normalized = toc?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toScheduledOption(
  journey: SavedJourney,
  schedule: ParsedJourney,
  originStop: ParsedStop,
  destinationStop: ParsedStop,
): JourneyOption | null {
  const departure = originStop.departure;
  const arrival = destinationStop.arrival ?? destinationStop.departure;

  if (!departure) {
    return null;
  }

  const operatorCode = toOperatorCode(schedule.toc);
  const optionId = schedule.rid ?? `${journey.id}-${schedule.ssd ?? "unknown"}-${departure}`;

  return {
    id: optionId,
    title: journey.destination.label,
    scheduledDeparture: departure,
    scheduledArrival: arrival,
    expectedDeparture: departure,
    expectedArrival: arrival,
    platform: originStop.platform ?? destinationStop.platform,
    operatorCode,
  };
}

function collectOptionsForJourney(
  journey: SavedJourney,
  schedules: ParsedJourney[],
  now: Date,
  timeWindowHours: number,
): JourneyOption[] {
  const originCrs = journey.origin.id.toUpperCase();
  const destinationCrs = journey.destination.id.toUpperCase();
  const start = now;
  const end = getWindowEnd(now, timeWindowHours);
  const options: JourneyOption[] = [];

  for (const schedule of schedules) {
    if (!schedule.ssd) {
      continue;
    }

    const originIndex = schedule.stops.findIndex((stop) => stop.crs === originCrs);

    if (originIndex < 0) {
      continue;
    }

    const destinationIndex = schedule.stops.findIndex(
      (stop, index) => index > originIndex && stop.crs === destinationCrs,
    );

    if (destinationIndex < 0) {
      continue;
    }

    const originStop = schedule.stops[originIndex];
    const destinationStop = schedule.stops[destinationIndex];
    const scheduledDeparture = originStop.departure;

    if (!scheduledDeparture) {
      continue;
    }

    const departureDate = toIsoFromScheduleDate(schedule.ssd, scheduledDeparture);

    if (!departureDate || !isWithinWindow(departureDate, start, end)) {
      continue;
    }

    const option = toScheduledOption(journey, schedule, originStop, destinationStop);

    if (option) {
      options.push(option);
    }
  }

  options.sort((left, right) =>
    compareClock(left.scheduledDeparture, right.scheduledDeparture),
  );

  const seen = new Set<string>();

  return options.filter((option) => {
    const key = [
      option.scheduledDeparture ?? "",
      option.scheduledArrival ?? "",
      option.operatorCode ?? "",
      option.title ?? "",
    ]
      .map((value) => value.toUpperCase())
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function downloadGzipXml(
  storage: Storage,
  bucketName: string,
  objectName: string,
) {
  const [buffer] = await storage.bucket(bucketName).file(objectName).download();
  return gunzipSync(buffer).toString("utf-8");
}

function getBucketConfig() {
  const bucketName = normalizeEnvValue(process.env.TRAIN_TICKER_DAILY_SCHEDULE_BUCKET);
  const prefix =
    normalizeEnvValue(process.env.TRAIN_TICKER_DAILY_SCHEDULE_PREFIX) ??
    DEFAULT_PREFIX;

  if (!bucketName) {
    return null;
  }

  return {
    bucketName,
    prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function loadScheduledOptionsForJourneys(
  journeys: SavedJourney[],
  timeWindowHours: number,
): Promise<Record<string, JourneyOption[]>> {
  const config = getBucketConfig();

  if (!config || journeys.length === 0) {
    return {};
  }

  const storage = new Storage();
  const [files] = await storage.bucket(config.bucketName).getFiles({
    prefix: config.prefix,
  });
  const names = files.map((file) => file.name);
  const latestRun = pickLatestRun(names);

  if (!latestRun) {
    return {};
  }

  const { timetableName, referenceName } = pickLatestFilesForRun(names, latestRun);

  if (!timetableName || !referenceName) {
    return {};
  }

  const [timetableXml, referenceXml] = await Promise.all([
    downloadGzipXml(storage, config.bucketName, timetableName),
    downloadGzipXml(storage, config.bucketName, referenceName),
  ]);
  const refMap = parseReferenceMap(referenceXml);
  const schedules = parseJourneys(timetableXml, refMap);
  const effectiveWindowHours = clampTimeWindowHours(timeWindowHours);
  const now = new Date();

  return Object.fromEntries(
    journeys.map((journey) => [
      journey.id,
      collectOptionsForJourney(journey, schedules, now, effectiveWindowHours),
    ]),
  );
}

export async function tryLoadScheduledOptionsForJourneys(
  journeys: SavedJourney[],
  timeWindowHours: number,
): Promise<{ optionsByJourneyId: Record<string, JourneyOption[]>; alert?: string }> {
  try {
    return {
      optionsByJourneyId: await loadScheduledOptionsForJourneys(
        journeys,
        timeWindowHours,
      ),
    };
  } catch (error) {
    return {
      optionsByJourneyId: {},
      alert: dedupeText([
        "Timetable schedule lookup failed.",
        getErrorMessage(error),
      ]).join(" "),
    };
  }
}

export const __testing = {
  parseReferenceMap,
  parseJourneys,
  collectOptionsForJourney,
  pickLatestRun,
  pickLatestFilesForRun,
};
