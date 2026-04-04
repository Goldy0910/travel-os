"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import BackLink from "@/app/app/_components/back-link";
import Link from "next/link";
import type { RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import EntityCommentsBlock, {
  type EntityCommentDTO,
} from "../../_components/entity-comments-block";
import { deleteExpenseAction, saveExpenseAction } from "../../data-actions";
import { formatInr } from "../_lib/format-inr";

export type ExpenseCardDTO = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitTypeRaw: string;
  dateLabel: string;
  dateInput: string;
  myShare: number;
  isPaidByYou: boolean;
};

type TripExpensesClientProps = {
  tripId: string;
  tripTitle: string;
  defaultPaidBy: string;
  memberCount: number;
  totalSpent: number;
  yourShareTotal: number;
  netBalance: number;
  expenses: ExpenseCardDTO[];
  initialError: string;
  currentUserId: string;
  memberLabelByUserId: Record<string, string>;
  expenseCommentsById: Record<string, EntityCommentDTO[]>;
};

function splitTypeLabel(raw: string) {
  const s = raw.toLowerCase();
  if (s === "equal") return "Equal";
  if (s === "full") return "Full amount";
  if (s === "none") return "None";
  if (s === "custom") return "Custom";
  return raw;
}

function useDismissOnOutsideClick(
  open: boolean,
  onClose: () => void,
  excludeRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (excludeRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, onClose, excludeRef]);
}

function IconDotsVertical({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function ExpenseRowMenu({
  tripId,
  expenseId,
  onEdit,
}: {
  tripId: string;
  expenseId: string;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismissOnOutsideClick(open, () => setOpen(false), wrapRef);

  return (
    <div className="relative shrink-0 self-start" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <span className="sr-only">Expense options</span>
        <IconDotsVertical />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-0.5 min-w-[9rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Update
          </button>
          <form
            action={deleteExpenseAction.bind(null, tripId, expenseId)}
            onSubmit={(e) => {
              if (!window.confirm("Delete this expense? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function isoDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ExpenseFormSheet({
  open,
  onClose,
  tripId,
  formKey,
  editing,
  defaultPaidBy,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  formKey: string;
  editing: ExpenseCardDTO | null;
  defaultPaidBy: string;
}) {
  const saveAction = useCallback((fd: FormData) => saveExpenseAction(tripId, fd), [tripId]);

  const titleDefault = editing?.title ?? "";
  const amountDefault = editing ? String(editing.amount) : "";
  const paidByDefault = editing?.paidBy ?? defaultPaidBy;
  const splitDefault = editing?.splitTypeRaw ?? "equal";
  const dateDefault = editing?.dateInput?.trim() || isoDateLocal(new Date());

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title={editing ? "Update expense" : "Add expense"}
      description="Split trip costs fairly with your group."
      panelClassName="max-h-[72vh]"
      titleId="expense-sheet-title"
    >
      <form key={formKey} action={saveAction} className="flex flex-col gap-4 pb-1">
        {editing ? <input type="hidden" name="expenseId" value={editing.id} /> : null}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            name="title"
            required
            defaultValue={titleDefault}
            placeholder="e.g. Dinner, Taxi"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Amount (₹)</span>
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            defaultValue={amountDefault}
            placeholder="0"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Paid by</span>
          <input
            name="paidBy"
            required
            defaultValue={paidByDefault}
            placeholder="Name or email"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Split type</span>
            <select
              name="splitType"
              required
              defaultValue={splitDefault}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="equal">Equal</option>
              <option value="custom">Custom</option>
              <option value="full">Full</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={dateDefault}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800 shadow-sm active:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-xl bg-slate-900 py-3 text-base font-medium text-white shadow-md shadow-slate-900/20"
          >
            Save
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
}

export default function TripExpensesClient({
  tripId,
  tripTitle,
  defaultPaidBy,
  memberCount,
  totalSpent,
  yourShareTotal,
  netBalance,
  expenses,
  initialError,
  currentUserId,
  memberLabelByUserId,
  expenseCommentsById,
}: TripExpensesClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCardDTO | null>(null);
  const formKeySeq = useRef(0);
  const [formKey, setFormKey] = useState("expense-new-0");

  const openAdd = () => {
    formKeySeq.current += 1;
    setEditing(null);
    setFormKey(`expense-new-${formKeySeq.current}`);
    setSheetOpen(true);
  };

  const openEdit = (row: ExpenseCardDTO) => {
    formKeySeq.current += 1;
    setEditing(row);
    setFormKey(`expense-edit-${row.id}-${formKeySeq.current}`);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditing(null);
  };

  const membersLabel =
    memberCount > 0
      ? `${memberCount} member${memberCount === 1 ? "" : "s"} on this trip`
      : "Members on this trip";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <BackLink href="/app/trips">All trips</BackLink>
        <BackLink href="/app/home">Home</BackLink>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-md">
        <p className="text-sm text-slate-300">{tripTitle}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="mt-2 text-xs text-slate-400">{membersLabel}</p>
        <Link
          href={`/app/trip/${tripId}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
        >
          Trip overview
        </Link>
      </section>

      {initialError ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{initialError}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-lg" aria-hidden>
                💰
              </span>
              Total spent
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {formatInr(totalSpent)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-lg" aria-hidden>
                👤
              </span>
              Your share
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {formatInr(yourShareTotal)}
            </p>
          </div>
        </div>

        <div
          className={`mt-4 rounded-2xl px-4 py-3.5 text-sm font-semibold ${
            netBalance < 0
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
              : netBalance > 0
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
          }`}
        >
          {netBalance < 0 && <>You owe {formatInr(Math.abs(netBalance))}</>}
          {netBalance > 0 && <>You are owed {formatInr(netBalance)}</>}
          {netBalance === 0 && <>You are all settled up</>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All expenses</h2>

        {expenses.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="rounded-2xl bg-slate-100 p-5 text-3xl" aria-hidden>
              🧾
            </div>
            <p className="mt-5 text-base font-semibold text-slate-900">No expenses added yet</p>
            <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-slate-600">
              Start tracking your trip expenses
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {expenses.map((row) => (
              <li key={row.id}>
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5">
                  <div className="flex p-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900">{row.title}</p>
                          <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                            {formatInr(row.amount)}
                          </p>
                        </div>
                        {row.isPaidByYou ? (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100">
                            You paid
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-100">
                            Paid by {row.paidBy}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        Your share:{" "}
                        <span className="text-slate-900">{formatInr(row.myShare)}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                          Split: {splitTypeLabel(row.splitTypeRaw)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                          {row.dateLabel || "No date"}
                        </span>
                        {memberCount > 0 ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-500">
                            {memberCount} splitting
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ExpenseRowMenu tripId={tripId} expenseId={row.id} onEdit={() => openEdit(row)} />
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <EntityCommentsBlock
                      tripId={tripId}
                      entityType="expense"
                      entityId={row.id}
                      currentUserId={currentUserId}
                      initialComments={expenseCommentsById[row.id] ?? []}
                      memberLabelByUserId={memberLabelByUserId}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        aria-label="Add expense"
        onClick={openAdd}
        className="fixed bottom-6 right-6 z-[110] flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95"
      >
        +
      </button>

      <ExpenseFormSheet
        open={sheetOpen}
        onClose={closeSheet}
        tripId={tripId}
        formKey={formKey}
        editing={editing}
        defaultPaidBy={defaultPaidBy}
      />
    </>
  );
}
