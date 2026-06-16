import { TrainTickerApp } from "@/components/train-ticker-app";

function isTruthyFlag(value: string | undefined) {
  return /^\s*(1|true|on|yes)\s*$/i.test(value ?? "");
}

export default function Home() {
  const hardCodedAlertEnabled = isTruthyFlag(
    process.env.HARD_CODED_ALERTS,
  );

  return <TrainTickerApp hardCodedAlertEnabled={hardCodedAlertEnabled} />;
}
