import { parseMasterTripFile } from "@/lib/master-trip-file";
import { applyRefinementPatch, runRefinementEngine } from "@/lib/trip-refinement";
import type { MasterRefinementChatMessage } from "@/lib/master-trip-file/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

type RequestBody = {
  masterId?: string;
  expectedVersion?: number;
  message?: string;
  quickActionId?: string;
};

function sseLine(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function* streamTextChunks(text: string): AsyncGenerator<string> {
  const words = text.split(/(\s+)/);
  let buf = "";
  for (const w of words) {
    buf += w;
    yield buf;
    await new Promise((r) => setTimeout(r, 12));
  }
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const masterId = typeof body.masterId === "string" ? body.masterId.trim() : "";
  const expectedVersion = Number(body.expectedVersion);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const quickActionId =
    typeof body.quickActionId === "string" ? body.quickActionId.trim() : undefined;

  if (!masterId) {
    return new Response(JSON.stringify({ error: "Missing masterId" }), { status: 400 });
  }
  if (!message && !quickActionId) {
    return new Response(JSON.stringify({ error: "Message or quick action required" }), {
      status: 400,
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401 });
  }

  const { data: row, error: loadError } = await supabase
    .from("trip_master_files")
    .select("id, version, data, trip_id")
    .eq("id", masterId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError || !row) {
    return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404 });
  }

  const version = Number(row.version) || 1;
  if (expectedVersion !== version) {
    return new Response(
      JSON.stringify({ error: "Plan was updated elsewhere. Refresh and try again." }),
      { status: 409 },
    );
  }

  const file = parseMasterTripFile(row.data);
  if (!file) {
    return new Response(JSON.stringify({ error: "Invalid plan data" }), { status: 500 });
  }

  const userText =
    message ||
    (quickActionId ? `Quick action: ${quickActionId.replace(/-/g, " ")}` : "");

  const engineResult = await runRefinementEngine({
    message: userText,
    quickActionId,
    file,
  });

  const { file: nextFile, changedSections } = applyRefinementPatch(
    file,
    engineResult.patch,
    userText,
  );

  const now = new Date().toISOString();
  const userMsg: MasterRefinementChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: userText,
    at: now,
    quickActionId,
  };
  const assistantMsg: MasterRefinementChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: engineResult.patch.assistantMessage,
    at: new Date().toISOString(),
    affectedSections: changedSections,
  };

  const chatMessages = [
    ...(file.refinementChat?.messages ?? []),
    userMsg,
    assistantMsg,
  ].slice(-40);

  const persistedFile = {
    ...nextFile,
    refinementChat: { messages: chatMessages },
  };

  const nextVersion = version + 1;
  const { error: updateError } = await supabase
    .from("trip_master_files")
    .update({
      data: persistedFile,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", masterId)
    .eq("version", version);

  if (updateError) {
    return new Response(JSON.stringify({ error: "Failed to save refinement" }), { status: 500 });
  }

  revalidatePath(`/app/master-trip/${masterId}`);

  const encoder = new TextEncoder();
  const assistantText = engineResult.patch.assistantMessage;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const partial of streamTextChunks(assistantText)) {
          controller.enqueue(encoder.encode(sseLine({ type: "token", text: partial })));
        }
        controller.enqueue(
          encoder.encode(
            sseLine({
              type: "done",
              version: nextVersion,
              source: engineResult.source,
              affectedSections: changedSections,
              patch: engineResult.patch,
              file: {
                preferences: persistedFile.preferences,
                itinerary: persistedFile.itinerary,
                practical: persistedFile.practical,
                recommendation: {
                  whyItFits: persistedFile.recommendation.whyItFits,
                  explanation: persistedFile.recommendation.explanation,
                },
              },
              messages: chatMessages,
            }),
          ),
        );
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            sseLine({
              type: "error",
              error: e instanceof Error ? e.message : "Stream failed",
            }),
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
