import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set(["documents", "clothes", "electronics", "health", "toiletries", "misc"]);

/**
 * Try in order for generativelanguage.googleapis.com v1beta :generateContent.
 * Avoid gemini-1.5-flash-8b — not exposed for generateContent on v1beta (404).
 * See: https://ai.google.dev/gemini-api/docs/models
 */
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
] as const;

function normalizeCategory(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return ALLOWED.has(s) ? s : "misc";
}

function geminiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const err = (data as { error?: { message?: string; status?: string } }).error;
  if (!err || typeof err !== "object") return null;
  const msg = err.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

function extractTextFromGeminiResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (root.promptFeedback?.blockReason) {
    return null;
  }
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured.", items: [] },
      { status: 503 },
    );
  }

  let body: {
    destination?: string;
    duration_days?: number;
    activities?: string[];
    travel_month?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", items: [] }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination : "";
  const duration_days =
    typeof body.duration_days === "number" && Number.isFinite(body.duration_days)
      ? Math.max(1, Math.min(90, Math.floor(body.duration_days)))
      : 7;
  const travel_month = typeof body.travel_month === "string" ? body.travel_month : "";
  const activities = Array.isArray(body.activities)
    ? body.activities.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    : [];

  const prompt = `You are a travel packing assistant. Generate a packing checklist for:
- Destination: ${destination || "unspecified"}
- Trip duration: ${duration_days} days
- Month of travel: ${travel_month || "unspecified"}
- Planned activities: ${activities.length > 0 ? activities.join(", ") : "general sightseeing"}

Return ONLY a JSON array. No explanation, no markdown, no code blocks. Example format:
[{"label": "Passport", "category": "documents"}, {"label": "T-shirts", "category": "clothes"}]

Categories allowed: documents, clothes, electronics, health, toiletries, misc

Include destination-specific items (e.g. sunscreen for beach, rain jacket for monsoon, modest clothing for religious sites). Max 30 items.`;

  let lastFailure: { status: number; model: string; message: string; raw?: unknown } | null = null;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const apiMsg = geminiErrorMessage(data);
      lastFailure = {
        status: response.status,
        model,
        message: apiMsg || `HTTP ${response.status}`,
        raw: data,
      };
      continue;
    }

    const apiErr = geminiErrorMessage(data);
    if (apiErr) {
      lastFailure = {
        status: 500,
        model,
        message: apiErr,
        raw: data,
      };
      continue;
    }

    const text = extractTextFromGeminiResponse(data);
    if (!text) {
      lastFailure = {
        status: 500,
        model,
        message: "Empty or blocked response from the model.",
        raw: data,
      };
      continue;
    }

    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (!Array.isArray(parsed)) {
        lastFailure = {
          status: 500,
          model,
          message: "Model did not return a JSON array.",
        };
        continue;
      }
      const items = parsed
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as { label?: string; category?: string };
          const label = typeof r.label === "string" ? r.label.trim() : "";
          if (!label) return null;
          return { label, category: normalizeCategory(r.category) };
        })
        .filter((x): x is { label: string; category: string } => x != null)
        .slice(0, 30);

      return NextResponse.json({ items });
    } catch {
      lastFailure = {
        status: 500,
        model,
        message: "Could not parse model output as JSON.",
      };
      continue;
    }
  }

  const hint =
    lastFailure?.status === 404
      ? "Model not found for your API key or region. Enable Generative Language API in Google Cloud and check billing."
      : lastFailure?.status === 403 || lastFailure?.status === 401
        ? "API key rejected or missing permission for Gemini."
        : "All Gemini models failed. Check GEMINI_API_KEY and Google AI Studio / Cloud quotas.";

  return NextResponse.json(
    {
      error: lastFailure
        ? `${lastFailure.message} (last attempt: ${lastFailure.model})`
        : "Gemini request failed.",
      hint: `${hint} Models attempted: ${GEMINI_MODELS.join(", ")}.`,
      items: [],
      ...(process.env.NODE_ENV === "development" && lastFailure?.raw
        ? { detail: lastFailure.raw }
        : {}),
    },
    { status: 502 },
  );
}
