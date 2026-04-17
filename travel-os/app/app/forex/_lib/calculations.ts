export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function effectiveRate(baseRateToInr: number, markupPercent: number, flatFeeInr: number, amount: number): number {
  if (!Number.isFinite(baseRateToInr) || baseRateToInr <= 0) return 0;
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
  const markupMultiplier = 1 + markupPercent / 100;
  const withMarkup = baseRateToInr * markupMultiplier;
  const flatPerUnit = (Number.isFinite(flatFeeInr) ? flatFeeInr : 0) / safeAmount;
  return round2(withMarkup + flatPerUnit);
}

export function convertToInr(amount: number, rateToInr: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rateToInr)) return 0;
  return round2(Math.max(0, amount) * Math.max(0, rateToInr));
}

export function tipAmountLocal(billAmount: number, tipPercent: number): number {
  if (!Number.isFinite(billAmount) || !Number.isFinite(tipPercent)) return 0;
  return round2(Math.max(0, billAmount) * (tipPercent / 100));
}

export function hoursAgoLabel(fromIso: string): string {
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return "unknown";
  const diffMs = Date.now() - t;
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (hours < 1) return "just now";
  if (hours === 1) return "1 hr ago";
  return `${hours} hrs ago`;
}

export function recommendationText(input: {
  atmRate: number;
  airportRate: number;
  localRate: number;
}) {
  const entries = [
    { label: "ATM", rate: input.atmRate },
    { label: "Airport exchange", rate: input.airportRate },
    { label: "Local exchange", rate: input.localRate },
  ].filter((entry) => entry.rate > 0);

  if (entries.length < 2) return "Add amount and rate to compare exchange options.";

  entries.sort((a, b) => a.rate - b.rate);
  const best = entries[0]!;
  const worst = entries[entries.length - 1]!;
  const spread = (((worst.rate - best.rate) / best.rate) * 100).toFixed(1);
  return `${best.label} currently gives the best effective rate. It is about ${spread}% better than ${worst.label}.`;
}
