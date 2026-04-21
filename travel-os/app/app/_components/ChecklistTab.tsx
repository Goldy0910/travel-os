"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORIES = ["documents", "clothes", "electronics", "health", "toiletries", "misc"] as const;

const CATEGORY_ICONS: Record<string, string> = {
  documents: "📄",
  clothes: "👕",
  electronics: "🔌",
  health: "💊",
  toiletries: "🧴",
  misc: "🎒",
};

type Item = {
  id: string;
  label: string;
  category: string;
  is_checked: boolean;
  sort_order: number;
};

type Checklist = { id: string; is_shared: boolean; items: Item[] };

type ChecklistRow = {
  id: string;
  is_shared: boolean;
  checklist_items?: Item[] | null;
};

type Props = {
  tripId: string;
  destination: string;
  durationDays: number;
  travelMonth: string;
  activities?: string[];
};

function normalizeCategory(raw: string): string {
  const c = raw.trim().toLowerCase();
  return CATEGORIES.includes(c as (typeof CATEGORIES)[number]) ? c : "misc";
}

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function ChecklistTab({
  tripId,
  destination,
  durationDays,
  travelMonth,
  activities = [],
}: Props) {
  // Keep one client instance for this mounted tab to avoid re-fetch loops on each render.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "shared">("personal");
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [personalChecklist, setPersonalChecklist] = useState<Checklist | null>(null);
  const [sharedChecklist, setSharedChecklist] = useState<Checklist | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<string>("misc");
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; checklist_template_items?: ItemTemplateRow[] }>
  >([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const current = activeTab === "personal" ? personalChecklist : sharedChecklist;
  const setCurrent = activeTab === "personal" ? setPersonalChecklist : setSharedChecklist;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase.auth as { getUser: () => Promise<{ data: { user: { id: string } | null } }> }).getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("members")
        .select("role")
        .eq("trip_id", tripId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const role = String((data as { role?: string } | null)?.role ?? "").trim().toLowerCase();
      setIsOrganizer(role === "organizer");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, tripId, userId]);

  const canAddToCurrentChecklist = activeTab === "personal" || isOrganizer;

  const loadChecklists = useCallback(async () => {
    if (!userId) return;

    const selectQ = "*, checklist_items(*)";

    const { data: personalInitial, error: personalErr } = await supabase
      .from("checklists")
      .select(selectQ)
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .eq("is_shared", false)
      .maybeSingle();

    if (personalErr) {
      if (personalErr.code === "PGRST205") {
        toast.error("Checklists are not set up yet. Apply migration 20260420_trip_checklists.sql.");
      } else {
        toast.error(personalErr.message || "Could not load your checklist.");
      }
      return;
    }

    let personal = personalInitial as ChecklistRow | null;

    if (!personal) {
      const ins = await supabase
        .from("checklists")
        .insert({ trip_id: tripId, user_id: userId, is_shared: false })
        .select(selectQ)
        .single();
      if (ins.error) {
        const retry = await supabase
          .from("checklists")
          .select(selectQ)
          .eq("trip_id", tripId)
          .eq("user_id", userId)
          .eq("is_shared", false)
          .maybeSingle();
        personal = retry.data as ChecklistRow | null;
        if (!personal) {
          toast.error(ins.error.message || "Could not create personal checklist.");
          return;
        }
      } else {
        personal = ins.data as ChecklistRow;
      }
    }

    const p = personal as ChecklistRow;
    setPersonalChecklist({
      id: p.id,
      is_shared: !!p.is_shared,
      items: (p.checklist_items ?? []).map(normalizeItemRow),
    });

    let { data: shared } = await supabase
      .from("checklists")
      .select(selectQ)
      .eq("trip_id", tripId)
      .eq("is_shared", true)
      .maybeSingle();

    if (!shared) {
      const ins = await supabase
        .from("checklists")
        .insert({ trip_id: tripId, user_id: null, is_shared: true })
        .select(selectQ)
        .single();
      if (ins.error) {
        const retry = await supabase
          .from("checklists")
          .select(selectQ)
          .eq("trip_id", tripId)
          .eq("is_shared", true)
          .maybeSingle();
        shared = retry.data as ChecklistRow | null;
        if (!shared) {
          toast.error(ins.error.message || "Could not create group checklist.");
          return;
        }
      } else {
        shared = ins.data as ChecklistRow;
      }
    }

    const s = shared as ChecklistRow;
    setSharedChecklist({
      id: s.id,
      is_shared: !!s.is_shared,
      items: (s.checklist_items ?? []).map(normalizeItemRow),
    });
  }, [supabase, tripId, userId]);

  useEffect(() => {
    if (userId) void loadChecklists();
  }, [userId, loadChecklists]);

  async function addItem() {
    if (!current) {
      toast.message("Checklist is still loading. Please try again.");
      return;
    }
    if (activeTab === "shared" && !isOrganizer) {
      toast.message("Only the organiser can add items to the Group Checklist.");
      return;
    }
    if (!newLabel.trim()) {
      toast.message("Enter an item name first.");
      return;
    }
    const normalizedNewLabel = normalizeLabel(newLabel);
    const alreadyExists = current.items.some((item) => normalizeLabel(item.label) === normalizedNewLabel);
    if (alreadyExists) {
      toast.message("That item is already in your checklist.");
      return;
    }
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        checklist_id: current.id,
        label: newLabel.trim(),
        category: normalizeCategory(newCategory),
        created_by: userId,
        sort_order: (current.items?.length || 0) + 1,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message || "Could not add item.");
      return;
    }
    if (data) {
      setCurrent((prev) => (prev ? { ...prev, items: [...prev.items, normalizeItemRow(data as ItemRow)] } : prev));
      setNewLabel("");
      setIsAddModalOpen(false);
    }
  }

  async function toggleItem(itemId: string, currentValue: boolean) {
    const { error } = await supabase
      .from("checklist_items")
      .update({
        is_checked: !currentValue,
        checked_by: !currentValue ? userId : null,
        checked_at: !currentValue ? new Date().toISOString() : null,
      })
      .eq("id", itemId);
    if (error) {
      toast.error(error.message || "Could not update item.");
      return;
    }
    setCurrent((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId ? { ...i, is_checked: !currentValue } : i,
            ),
          }
        : prev,
    );
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message || "Could not delete item.");
      return;
    }
    setCurrent((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
    );
  }

  async function generateWithAI() {
    if (!current) return;
    if (activeTab === "shared" && !isOrganizer) {
      toast.message("Only the organiser can add items to the Group Checklist.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          duration_days: durationDays,
          activities,
          travel_month: travelMonth,
        }),
      });
      const data = (await res.json()) as {
        items?: Array<{ label: string; category?: string }>;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" ");
        toast.error(msg || "AI generate failed.");
        return;
      }
      const rawItems = Array.isArray(data.items) ? data.items : [];
      if (rawItems.length === 0) {
        toast.message("No items returned. Set GEMINI_API_KEY or try again.");
        return;
      }
      const existingLabelSet = new Set((current.items ?? []).map((item) => normalizeLabel(item.label)));
      const dedupedRawItems: Array<{ label: string; category?: string }> = [];
      for (const item of rawItems) {
        const cleanedLabel = String(item.label ?? "").trim();
        if (!cleanedLabel) continue;
        const key = normalizeLabel(cleanedLabel);
        if (existingLabelSet.has(key)) continue;
        existingLabelSet.add(key);
        dedupedRawItems.push({ label: cleanedLabel, category: item.category });
      }
      if (dedupedRawItems.length === 0) {
        toast.message("All generated items already exist in your checklist.");
        return;
      }
      const newItems = dedupedRawItems.map((item, i) => ({
        checklist_id: current.id,
        label: item.label,
        category: normalizeCategory(item.category ?? "misc"),
        created_by: userId,
        sort_order: (current.items?.length || 0) + i + 1,
      }));
      const { data: inserted, error } = await supabase.from("checklist_items").insert(newItems).select();
      if (error) {
        toast.error(error.message || "Could not save generated items.");
        return;
      }
      if (inserted?.length) {
        const rows = inserted as ItemRow[];
        setCurrent((prev) =>
          prev ? { ...prev, items: [...prev.items, ...rows.map((row) => normalizeItemRow(row))] } : prev,
        );
        const skipped = rawItems.length - inserted.length;
        if (skipped > 0) {
          toast.success(`Added ${inserted.length} items (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped).`);
        } else {
          toast.success(`Added ${inserted.length} items.`);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }

  type ItemTemplateRow = { label: string; category?: string | null; sort_order?: number | null };

  async function loadTemplates() {
    setShowTemplates(true);
    setIsLoadingTemplates(true);
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*, checklist_template_items(*)");
    if (error) {
      if (error.code === "PGRST205") {
        toast.error("Templates table missing. Apply checklist migration.");
      } else {
        toast.error(error.message || "Could not load templates.");
      }
      setIsLoadingTemplates(false);
      return;
    }
    setTemplates((data ?? []) as typeof templates);
    setIsLoadingTemplates(false);
  }

  async function applyTemplate(template: {
    id: string;
    checklist_template_items?: ItemTemplateRow[];
  }) {
    if (!current) return;
    if (activeTab === "shared" && !isOrganizer) {
      toast.message("Only the organiser can add items to the Group Checklist.");
      return;
    }
    const rows = template.checklist_template_items ?? [];
    if (rows.length === 0) {
      toast.message("This template has no items.");
      return;
    }
    const existingLabelSet = new Set((current.items ?? []).map((item) => normalizeLabel(item.label)));
    const dedupedRows: ItemTemplateRow[] = [];
    for (const row of rows) {
      const cleanedLabel = String(row.label ?? "").trim();
      if (!cleanedLabel) continue;
      const key = normalizeLabel(cleanedLabel);
      if (existingLabelSet.has(key)) continue;
      existingLabelSet.add(key);
      dedupedRows.push({ ...row, label: cleanedLabel });
    }
    if (dedupedRows.length === 0) {
      toast.message("All template items already exist in your checklist.");
      setShowTemplates(false);
      return;
    }
    const items = dedupedRows.map((i, idx) => ({
      checklist_id: current.id,
      label: i.label,
      category: normalizeCategory(i.category ?? "misc"),
      created_by: userId,
      sort_order: (current.items?.length || 0) + idx + 1,
    }));
    const { data: inserted, error } = await supabase.from("checklist_items").insert(items).select();
    if (error) {
      toast.error(error.message || "Could not apply template.");
      return;
    }
    if (inserted?.length) {
      const rows = inserted as ItemRow[];
      setCurrent((prev) =>
        prev ? { ...prev, items: [...prev.items, ...rows.map((row) => normalizeItemRow(row))] } : prev,
      );
      const skipped = (template.checklist_template_items ?? []).length - inserted.length;
      if (skipped > 0) {
        toast.success(
          `Added ${inserted.length} items from template (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped).`,
        );
      } else {
        toast.success(`Added ${inserted.length} items from template.`);
      }
    }
    setShowTemplates(false);
  }

  const items = current?.items || [];
  const checked = items.filter((i) => i.is_checked).length;
  const progress = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
  const grouped = CATEGORIES.reduce(
    (acc, cat) => {
      const catItems = items.filter((i) => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    },
    {} as Record<string, Item[]>,
  );

  return (
    <div className="flex flex-col gap-4 px-0 py-1">
      <section className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <p className="text-sm font-semibold text-indigo-900">Pack smarter and avoid last-minute misses</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800">
          Build personal or shared checklists, track packing progress, and use AI/templates to create a list quickly.
        </p>
      </section>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(["personal", "shared"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {tab === "personal" ? "My Checklist" : "Group Checklist"}
          </button>
        ))}
      </div>

      {items.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-500">
              {checked} of {items.length} packed
            </span>
            <span className="font-medium text-gray-900">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void generateWithAI()}
          disabled={isGenerating || !current || !canAddToCurrentChecklist}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isGenerating ? "Generating…" : "✨ AI Generate"}
        </button>
        <button
          type="button"
          onClick={() => void loadTemplates()}
          disabled={isLoadingTemplates || !canAddToCurrentChecklist}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
        >
          {isLoadingTemplates ? "Loading templates..." : "📋 Templates"}
        </button>
      </div>
      {activeTab === "shared" && !isOrganizer ? (
        <p className="text-xs text-amber-800">
          Only the organiser can add items to the Group Checklist.
        </p>
      ) : null}

      {showTemplates ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-gray-700">Choose a template</p>
          {isLoadingTemplates ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-500">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates available.</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void applyTemplate(t)}
                className="rounded-lg border border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {t.name}{" "}
                <span className="text-gray-400">
                  ({(t.checklist_template_items ?? []).length} items)
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setShowTemplates(false)}
            className="mt-2 min-h-10 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {CATEGORY_ICONS[category]} {category}
            </span>
          </div>
          {catItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
            >
              <button
                type="button"
                onClick={() => void toggleItem(item.id, item.is_checked)}
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  item.is_checked ? "border-green-500 bg-green-500 text-white" : "border-gray-300"
                }`}
              >
                {item.is_checked ? <span className="text-xs">✓</span> : null}
              </button>
              <span
                className={`flex-1 text-sm ${item.is_checked ? "text-gray-400 line-through" : "text-gray-800"}`}
              >
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => void deleteItem(item.id)}
                className="px-1 text-xs text-gray-300 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <p className="mb-2 text-2xl">🎒</p>
          <p>No items yet. Use AI Generate or add manually.</p>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Add checklist item"
        onClick={() => {
          if (!canAddToCurrentChecklist) {
            toast.message("Only the organiser can add items to the Group Checklist.");
            return;
          }
          setIsAddModalOpen(true);
        }}
        disabled={!current || !canAddToCurrentChecklist}
        className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[110] flex h-14 w-14 min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 text-2xl font-light leading-none text-white shadow-lg shadow-slate-900/30 transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end bg-black/40 pb-[env(keyboard-inset-height,0px)] sm:items-center sm:justify-center sm:pb-0">
          <button
            type="button"
            aria-label="Close add item modal"
            onClick={() => setIsAddModalOpen(false)}
            className="absolute inset-0 h-full w-full"
          />
          <div className="relative z-[121] flex w-full max-h-[88dvh] flex-col rounded-t-2xl bg-white sm:max-h-[75vh] sm:max-w-md sm:rounded-2xl">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden" />
              <h3 className="text-base font-semibold text-gray-900">Add checklist item</h3>
              <p className="mt-1 text-xs text-gray-500">
                Pick a category and save the item to your current checklist.
              </p>

              <div className="mt-4 flex flex-col gap-3 pb-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-600">Category</span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_ICONS[c]} {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-600">Item</span>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addItem()}
                    placeholder="e.g. Passport, charger, jacket"
                    className="min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    autoFocus
                  />
                </label>
              </div>
            </div>
            <div className="shrink-0 flex gap-2 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addItem()}
                disabled={!current || !newLabel.trim()}
                className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ItemRow = {
  id: string;
  label: string;
  category?: string | null;
  is_checked?: boolean | null;
  sort_order?: number | null;
};

function normalizeItemRow(row: ItemRow): Item {
  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    category: normalizeCategory(String(row.category ?? "misc")),
    is_checked: !!row.is_checked,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
}
