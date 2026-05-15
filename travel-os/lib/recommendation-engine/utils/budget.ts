import type { BudgetTier } from "../types";

const BUDGET_ORDER: Record<BudgetTier, number> = {
  budget: 0,
  moderate: 1,
  premium: 2,
};

export function budgetLabel(tier: BudgetTier, days: number): string {
  const perDay =
    tier === "budget" ? "₹3k–6k" : tier === "moderate" ? "₹8k–15k" : "₹20k+";
  return `~${perDay}/day · ${days} days total (excl. flights)`;
}

export function budgetFitScore(
  userBudget: BudgetTier | undefined,
  destBudget: BudgetTier,
): number {
  if (!userBudget) return 75;
  const delta = Math.abs(BUDGET_ORDER[userBudget] - BUDGET_ORDER[destBudget]);
  if (delta === 0) return 100;
  if (delta === 1) return 65;
  return 30;
}
