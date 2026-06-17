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
- `NEXT_PUBLIC_POLL_INTERVAL_MS` controls board refresh cadence in milliseconds and defaults to `60000`.
- `HARD_CODED_ALERTS` toggles a hardcoded alert banner message at the top of the app when set to `true`.
- `MAPTILER_API_KEY` enables the UK map background.
- `REDIS_URL` enables public API rate limiting through Vercel Redis.
- `RATE_LIMIT_SEARCHES_PER_MINUTE` controls search requests per IP and defaults to `30`.
- `RATE_LIMIT_JOURNEYS_PER_MINUTE` controls live journey refreshes per IP and defaults to `10`.

The site still starts without Darwin credentials. National Rail cards stay unconfigured until Darwin is set. Production API routes require Redis credentials for rate limiting.

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
