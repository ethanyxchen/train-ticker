import { Storage } from "@google-cloud/storage";

import {
  retainLatestEHSnapshot,
  retainLatestPPTimetable,
  type RetentionResult,
} from "./daily-schedule-retention";

type ManagedPrefix = "EHSnapshot" | "PPTimetable";

type ParsedArgs = {
  apply: boolean;
  bucketName: string;
  prefixes: ManagedPrefix[];
};

const DEFAULT_BUCKET_NAME = process.env.TRAIN_TICKER_DAILY_SCHEDULE_BUCKET?.trim() ?? "";
const DEFAULT_PREFIXES: ManagedPrefix[] = ["PPTimetable", "EHSnapshot"];
const PREFIX_LABELS = new Set<ManagedPrefix>(DEFAULT_PREFIXES);

function parseArgs(argv: string[]): ParsedArgs {
  let bucketName = DEFAULT_BUCKET_NAME;
  let apply = false;
  const prefixes: ManagedPrefix[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      apply = false;
      continue;
    }

    if (arg === "--bucket") {
      bucketName = readOptionValue(argv, index, "--bucket");
      index += 1;
      continue;
    }

    if (arg === "--prefix") {
      const prefix = readOptionValue(argv, index, "--prefix");

      if (!isManagedPrefix(prefix)) {
        throw new Error(
          `Unsupported prefix "${prefix}". Supported values: ${DEFAULT_PREFIXES.join(", ")}.`,
        );
      }

      prefixes.push(prefix);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument "${arg}".`);
  }

  if (bucketName.length === 0) {
    throw new Error(
      "Missing bucket name. Pass --bucket <name> or set TRAIN_TICKER_DAILY_SCHEDULE_BUCKET.",
    );
  }

  return {
    apply,
    bucketName,
    prefixes: prefixes.length === 0 ? DEFAULT_PREFIXES : Array.from(new Set(prefixes)),
  };
}

function readOptionValue(argv: string[], index: number, optionName: string) {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

function isManagedPrefix(value: string): value is ManagedPrefix {
  return PREFIX_LABELS.has(value as ManagedPrefix);
}

function getRetentionResult(prefix: ManagedPrefix, names: string[]) {
  if (prefix === "PPTimetable") {
    return retainLatestPPTimetable(names);
  }

  return retainLatestEHSnapshot(names);
}

function formatSample(label: string, names: string[]) {
  if (names.length === 0) {
    return [];
  }

  return [`${label}:`, ...names.slice(0, 5).map((name) => `  ${name}`)];
}

function formatResult(result: RetentionResult) {
  const lines = [
    `Prefix ${result.prefix}`,
    `latest run: ${result.latestRunKey ?? "none"}`,
    `keep: ${result.keep.length}`,
    `delete: ${result.remove.length}`,
    `ignored: ${result.ignored.length}`,
  ];

  return [
    ...lines,
    ...formatSample("keep sample", result.keep),
    ...formatSample("delete sample", result.remove),
    ...formatSample("ignored sample", result.ignored),
  ].join("\n");
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 404
  );
}

async function deleteNames(storage: Storage, bucketName: string, names: string[]) {
  const bucket = storage.bucket(bucketName);
  const chunkSize = 50;

  for (let index = 0; index < names.length; index += chunkSize) {
    const chunk = names.slice(index, index + chunkSize);

    await Promise.all(
      chunk.map(async (name) => {
        try {
          await bucket.file(name).delete();
        } catch (error) {
          if (isNotFoundError(error)) {
            return;
          }

          throw error;
        }
      }),
    );
  }
}

async function listPrefixNames(storage: Storage, bucketName: string, prefix: ManagedPrefix) {
  const [files] = await storage.bucket(bucketName).getFiles({
    prefix: `${prefix}/`,
  });

  return files.map((file) => file.name).sort((left, right) => left.localeCompare(right));
}

function printUsage() {
  console.log(
    [
      "Usage: npm run cleanup:daily-schedule -- [--bucket <name>] [--prefix <prefix>] [--dry-run|--apply]",
      "",
      "Defaults:",
      "  mode: dry-run",
      "  prefixes: PPTimetable, EHSnapshot",
      "  bucket env fallback: TRAIN_TICKER_DAILY_SCHEDULE_BUCKET",
    ].join("\n"),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("invalid_grant")) {
      return 'Google Cloud authentication failed. Run "gcloud auth application-default login" locally, or use a service account when the job runs on Cloud Run.';
    }

    if (error.message.includes("Could not load the default credentials")) {
      return 'Google Cloud authentication is not configured. Run "gcloud auth application-default login" locally, or attach a service account to the Cloud Run job.';
    }

    return error.message;
  }

  return String(error);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storage = new Storage();
  let totalDeleted = 0;

  console.log(`Bucket: ${args.bucketName}`);
  console.log(`Mode: ${args.apply ? "apply" : "dry-run"}`);

  for (const prefix of args.prefixes) {
    const names = await listPrefixNames(storage, args.bucketName, prefix);
    const result = getRetentionResult(prefix, names);

    console.log("");
    console.log(formatResult(result));

    if (!args.apply || result.remove.length === 0) {
      continue;
    }

    await deleteNames(storage, args.bucketName, result.remove);
    totalDeleted += result.remove.length;
  }

  console.log("");
  console.log(
    args.apply ? `Deleted ${totalDeleted} objects.` : "Dry run only. No objects were deleted.",
  );
}

void main().catch((error: unknown) => {
  console.error(getErrorMessage(error));

  process.exit(1);
});
