export type SplitType = "equal" | "exact" | "percentage" | "none";
export type SplitValueType = "amount" | "percentage";

export type MemberOption = {
  userId: string;
  label: string;
};

export type ComputeSplitInput = {
  amount: number;
  splitType: SplitType;
  paidByUserId: string;
  selectedParticipantIds: string[];
  includePayerInEqual: boolean;
  exactAmountsByUserId: Record<string, number>;
  percentagesByUserId: Record<string, number>;
};

export type ComputedParticipantRow = {
  userId: string;
  splitValue: number;
  splitType: SplitValueType;
  computedAmount: number;
  owesAmount: number;
};

export type ComputeSplitResult = {
  rows: ComputedParticipantRow[];
  errors: string[];
  remainingAmount: number;
  remainingPercentage: number;
};

const ROUND_FACTOR = 100;

function round2(value: number): number {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

function normalizeUnique(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function distributeEqual(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(amount * ROUND_FACTOR);
  const base = Math.floor(cents / count);
  const rem = cents - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = base + (i < rem ? 1 : 0);
    out.push(c / ROUND_FACTOR);
  }
  return out;
}

export function computeExpenseSplit(input: ComputeSplitInput): ComputeSplitResult {
  const errors: string[] = [];
  const amount = Number.isFinite(input.amount) ? round2(input.amount) : 0;

  if (!(amount > 0)) {
    errors.push("Amount must be greater than 0.");
  }
  if (!input.paidByUserId.trim()) {
    errors.push("Please select who paid.");
  }

  const selectedIds = normalizeUnique(input.selectedParticipantIds);
  const baseRows: ComputedParticipantRow[] = [];

  if (input.splitType === "none") {
    if (amount > 0 && input.paidByUserId.trim()) {
      baseRows.push({
        userId: input.paidByUserId,
        splitValue: amount,
        splitType: "amount",
        computedAmount: amount,
        owesAmount: 0,
      });
    }
    return {
      rows: baseRows,
      errors,
      remainingAmount: 0,
      remainingPercentage: 0,
    };
  }

  if (selectedIds.length === 0) {
    errors.push("Select at least one participant.");
    return {
      rows: [],
      errors,
      remainingAmount: amount,
      remainingPercentage: 100,
    };
  }

  if (input.splitType === "equal") {
    const targets = input.includePayerInEqual
      ? selectedIds
      : selectedIds.filter((id) => id !== input.paidByUserId);
    if (targets.length === 0) {
      errors.push("Equal split needs at least one participant after payer setting.");
      return { rows: [], errors, remainingAmount: amount, remainingPercentage: 100 };
    }
    const shares = distributeEqual(amount, targets.length);
    for (let i = 0; i < targets.length; i += 1) {
      const userId = targets[i]!;
      const computedAmount = shares[i]!;
      baseRows.push({
        userId,
        splitValue: computedAmount,
        splitType: "amount",
        computedAmount,
        owesAmount: userId === input.paidByUserId ? 0 : computedAmount,
      });
    }
  } else if (input.splitType === "exact") {
    let sum = 0;
    for (const userId of selectedIds) {
      const value = round2(Number(input.exactAmountsByUserId[userId] ?? 0));
      if (value < 0) {
        errors.push("Exact split amounts cannot be negative.");
        continue;
      }
      sum = round2(sum + value);
      baseRows.push({
        userId,
        splitValue: value,
        splitType: "amount",
        computedAmount: value,
        owesAmount: userId === input.paidByUserId ? 0 : value,
      });
    }
    if (Math.abs(sum - amount) > 0.01) {
      errors.push("Exact split total must match expense amount.");
    }
  } else if (input.splitType === "percentage") {
    let pctTotal = 0;
    let amountTotal = 0;
    for (const userId of selectedIds) {
      const pct = round2(Number(input.percentagesByUserId[userId] ?? 0));
      if (pct < 0) {
        errors.push("Percentage cannot be negative.");
        continue;
      }
      const computedAmount = round2((amount * pct) / 100);
      pctTotal = round2(pctTotal + pct);
      amountTotal = round2(amountTotal + computedAmount);
      baseRows.push({
        userId,
        splitValue: pct,
        splitType: "percentage",
        computedAmount,
        owesAmount: userId === input.paidByUserId ? 0 : computedAmount,
      });
    }
    if (Math.abs(pctTotal - 100) > 0.01) {
      errors.push("Percentage split must total 100%.");
    }
    // Fix rounding drift by adjusting payer row if present, else first row.
    const delta = round2(amount - amountTotal);
    if (Math.abs(delta) > 0.009 && baseRows.length > 0) {
      const idx =
        baseRows.findIndex((r) => r.userId === input.paidByUserId) >= 0
          ? baseRows.findIndex((r) => r.userId === input.paidByUserId)
          : 0;
      const row = baseRows[idx]!;
      row.computedAmount = round2(row.computedAmount + delta);
      if (row.userId !== input.paidByUserId) {
        row.owesAmount = row.computedAmount;
      }
    }
  }

  const othersOwe = round2(
    baseRows
      .filter((row) => row.userId !== input.paidByUserId)
      .reduce((sum, row) => sum + row.owesAmount, 0),
  );

  const payerRow = baseRows.find((row) => row.userId === input.paidByUserId);
  if (payerRow) {
    payerRow.owesAmount = round2(-othersOwe);
  } else if (input.paidByUserId) {
    baseRows.push({
      userId: input.paidByUserId,
      splitValue: 0,
      splitType: input.splitType === "percentage" ? "percentage" : "amount",
      computedAmount: 0,
      owesAmount: round2(-othersOwe),
    });
  }

  const sumAmount = round2(baseRows.reduce((sum, row) => sum + row.computedAmount, 0));
  const sumPct = round2(
    baseRows
      .filter((row) => row.splitType === "percentage")
      .reduce((sum, row) => sum + row.splitValue, 0),
  );
  const remainingAmount = round2(amount - sumAmount);
  const remainingPercentage =
    input.splitType === "percentage" ? round2(100 - sumPct) : 0;

  const result = {
    rows: baseRows,
    errors,
    remainingAmount,
    remainingPercentage,
  };
  return result;
}

export function previewLineForCurrentUser(
  rows: ComputedParticipantRow[],
  currentUserId: string,
): string {
  const me = rows.find((r) => r.userId === currentUserId);
  if (!me) return "You are not part of this split.";
  const value = round2(Math.abs(me.owesAmount));
  if (me.owesAmount > 0) return `You owe INR ${value.toFixed(2)}`;
  if (me.owesAmount < 0) return `You get INR ${value.toFixed(2)}`;
  return "You are settled up on this expense.";
}
