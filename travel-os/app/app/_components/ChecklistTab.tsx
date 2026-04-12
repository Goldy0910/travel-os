"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useCallback, useEffect, useState } from "react";
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

export default function ChecklistTab({
  tripId,
  destination,
  durationDays,
  travelMonth,
  activities = [],
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "shared">("personal");
  const [personalChecklist, setPersonalChecklist] = useState<Checklist | null>(null);
  const [sharedChecklist, setSharedChecklist] = useState<Checklist | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<string>("misc");
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; checklist_template_items?: ItemTemplateRow[] }>
  >([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const current = activeTab === "personal" ? personalChecklist : sharedChecklist;
  const setCurrent = activeTab === "personal" ? setPersonalChecklist : setSharedChecklist;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
    if (!newLabel.trim() || !current) return;
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
      const newItems = rawItems.map((item, i) => ({
        checklist_id: current.id,
        label: item.label.trim(),
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
        toast.success(`Added ${inserted.length} items.`);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  type ItemTemplateRow = { label: string; category?: string | null; sort_order?: number | null };

  async function loadTemplates() {
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*, checklist_template_items(*)");
    if (error) {
      if (error.code === "PGRST205") {
        toast.error("Templates table missing. Apply checklist migration.");
      } else {
        toast.error(error.message || "Could not load templates.");
      }
      return;
    }
    setTemplates((data ?? []) as typeof templates);
    setShowTemplates(true);
  }

  async function applyTemplate(template: {
    id: string;
    checklist_template_items?: ItemTemplateRow[];
  }) {
    if (!current) return;
    const rows = template.checklist_template_items ?? [];
    if (rows.length === 0) {
      toast.message("This template has no items.");
      return;
    }
    const items = rows.map((i, idx) => ({
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
      toast.success(`Added ${inserted.length} items from template.`);
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
          disabled={isGenerating || !current}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isGenerating ? "Generating…" : "✨ AI Generate"}
        </button>
        <button
          type="button"
          onClick={() => void loadTemplates()}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
        >
          📋 Templates
        </button>
      </div>

      {showTemplates ? (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-gray-700">Choose a template</p>
          {templates.length === 0 ? (
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
            className="mt-1 text-xs text-gray-400"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_ICONS[c]} {c}
            </option>
          ))}
        </select>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void addItem()}
          placeholder="Add item…"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void addItem()}
          disabled={!current}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>

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
