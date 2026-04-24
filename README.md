# Train Ticker

Minimal setup to run the site locally.

## Install

```bash
mise install
mise run install
cp .env.example .env.local
```

## Environment

Add the values you need in `.env.local`.

- `DARWIN_RDM_PROXY_URL` and `DARWIN_RDM_CONSUMER_KEY` enable live National Rail departures.
- `DARWIN_RDM_AUTH_TYPE=api-key` is the default Rail Data Marketplace proxy mode.
- `RDG_DISRUPTIONS_BASE_URL` and `RDG_DISRUPTIONS_CONSUMER_KEY` enable disruption-aware National Rail alerts and empty states through the Rail Data Marketplace disruptions API.
- `RDG_DISRUPTIONS_USER_AGENT` is optional and defaults to `TrainTicker/0.1`.
- `TFL_APP_ID` and `TFL_APP_KEY` are optional, but recommended for higher TfL rate limits.

The site still starts without credentials. National Rail cards stay unconfigured until Darwin is set, disruption enrichment stays off until the separate RDG Disruptions credentials are set, and Tube requests can run without TfL keys.

- `TRAIN_TICKER_DAILY_SCHEDULE_BUCKET` is optional and used by the daily schedule cleanup worker if you do not pass `--bucket`.

## Rail Disruptions Cache

RDG Disruptions responses are cached in-memory for 5 minutes per journey/operator combination. This keeps journey refreshes responsive while staying inside the RSPS5220 rule that disruption content must be refreshed or discarded within 1 hour.

## Development

```bash
mise run dev
```

Open `http://localhost:3000`.

## Production

```bash
mise run build
mise run start
```

## Daily Schedule Cleanup

The bucket cleanup worker lives in `workers/daily-schedule-cleanup`. It keeps only the newest batch in `PPTimetable/` and the newest file in `EHSnapshot/`. It ignores unrelated bucket objects.

Validate the worker locally:

```bash
npm run typecheck:worker
npm run test:worker
npm run build:worker
```

Dry run against the production bucket:

```bash
gcloud auth application-default login
npm run cleanup:daily-schedule -- --bucket train-ticker-daily-train-schedule-inbox --dry-run
```

Apply the cleanup:

```bash
npm run cleanup:daily-schedule -- --bucket train-ticker-daily-train-schedule-inbox --apply
```

If you set `TRAIN_TICKER_DAILY_SCHEDULE_BUCKET`, you can omit `--bucket`.

The recommended hosted schedule is `03:05 GMT`, based on the observed `PPTimetable` batch timestamp of about `02:05 GMT`.

Deploy only the worker source to Cloud Run Jobs:

```bash
gcloud run jobs deploy train-ticker-daily-schedule-cleanup --project train-ticker-494309 --region us-central1 --source workers/daily-schedule-cleanup --service-account daily-schedule-cleaner@train-ticker-494309.iam.gserviceaccount.com --set-env-vars "TRAIN_TICKER_DAILY_SCHEDULE_BUCKET=train-ticker-daily-train-schedule-inbox" --command npm --args run,cleanup:daily-schedule,--,--apply --tasks 1 --max-retries 0 --task-timeout 10m
```
