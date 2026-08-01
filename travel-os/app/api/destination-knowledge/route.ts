import {
  detectDestinationKnowledgeIntent,
  retrieveDestinationKnowledge,
  streamDestinationKnowledgeAnswer,
} from "@/lib/destination-knowledge";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

type Body = {
  question?: unknown;
  destinationSlugs?: unknown;
};

/**
 * Standalone Destination Knowledge RAG endpoint (not trip planning).
 * POST { question, destinationSlugs?: string[] }
 * Returns SSE: meta, delta, done | error
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ ok: false, error: "question is required" }, { status: 400 });
  }
  if (question.length > 2000) {
    return Response.json({ ok: false, error: "question is too long" }, { status: 400 });
  }

  const destinationSlugs = Array.isArray(body.destinationSlugs)
    ? body.destinationSlugs.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : undefined;

  if (!detectDestinationKnowledgeIntent(question) && !destinationSlugs?.length) {
    // Still allow explicit calls; soft-continue for open destination questions.
  }

  const encoder = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // closed
        }
      };

      try {
        const retrieval = await retrieveDestinationKnowledge({
          question,
          destinationSlugs,
          signal,
        });

        send({
          type: "meta",
          destinations: retrieval.destinations,
          topics: retrieval.topics,
          chunkCount: retrieval.chunks.length,
          sources: retrieval.chunks.map((c) => ({
            id: c.id,
            destination: c.destinationName,
            topic: c.topic,
            title: c.title,
            score: Number(c.score.toFixed(4)),
          })),
        });

        for await (const delta of streamDestinationKnowledgeAnswer({
          question,
          retrieval,
          signal,
        })) {
          if (signal.aborted) break;
          send({ type: "delta", text: delta });
        }

        send({ type: "done" });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          send({ type: "done" });
        } else {
          send({
            type: "error",
            message: error instanceof Error ? error.message : "Knowledge query failed",
          });
          send({ type: "done" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // ignore
        }
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
