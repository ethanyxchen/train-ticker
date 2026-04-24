export type RetentionResult = {
  prefix: string;
  latestRunKey: string | null;
  keep: string[];
  remove: string[];
  ignored: string[];
};

type MatchedName = {
  name: string;
  runKey: string;
};

function compareNames(left: string, right: string) {
  return left.localeCompare(right);
}

function retainLatestSchedules(
  prefix: string,
  names: string[],
  getRunKey: (name: string) => string | null,
): RetentionResult {
  const matched: MatchedName[] = [];
  const ignored: string[] = [];

  for (const name of names) {
    const runKey = getRunKey(name);

    if (runKey === null) {
      ignored.push(name);
      continue;
    }

    matched.push({
      name,
      runKey,
    });
  }

  ignored.sort(compareNames);

  if (matched.length === 0) {
    return {
      prefix,
      latestRunKey: null,
      keep: [],
      remove: [],
      ignored,
    };
  }

  const latestRunKey = matched.reduce(
    (latest, entry) => (entry.runKey > latest ? entry.runKey : latest),
    matched[0].runKey,
  );
  const keep = matched
    .filter((entry) => entry.runKey === latestRunKey)
    .map((entry) => entry.name)
    .sort(compareNames);
  const remove = matched
    .filter((entry) => entry.runKey !== latestRunKey)
    .map((entry) => entry.name)
    .sort(compareNames);

  return {
    prefix,
    latestRunKey,
    keep,
    remove,
    ignored,
  };
}

function getPPTimetableRunKey(name: string) {
  const match = /^PPTimetable\/(\d{14})_[^/]+\.xml\.gz$/.exec(name);
  return match?.[1] ?? null;
}

function getEHSnapshotRunKey(name: string) {
  const match = /^EHSnapshot\/EHSnapshot_(\d{6})_(\d{4})\.txt$/.exec(name);

  if (match === null) {
    return null;
  }

  return `20${match[1]}${match[2]}`;
}

export function retainLatestPPTimetable(names: string[]) {
  return retainLatestSchedules("PPTimetable", names, getPPTimetableRunKey);
}

export function retainLatestEHSnapshot(names: string[]) {
  return retainLatestSchedules("EHSnapshot", names, getEHSnapshotRunKey);
}
