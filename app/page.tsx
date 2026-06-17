import { TrainTickerApp } from "@/components/train-ticker-app";

export const dynamic = "force-dynamic";

function isTruthyFlag(value: string | undefined) {
  return /^\s*(1|true|on|yes)\s*$/i.test(value ?? "");
}

export default function Home() {
  const hardCodedAlertEnabled = isTruthyFlag(
    process.env.HARD_CODED_ALERTS,
  );
  const maptilerApiKey = process.env.MAPTILER_API_KEY?.trim();

  return (
    <TrainTickerApp
      hardCodedAlertEnabled={hardCodedAlertEnabled}
      maptilerApiKey={maptilerApiKey}
    />
  );
}
