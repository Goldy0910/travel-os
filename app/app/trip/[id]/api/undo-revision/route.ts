import { handleUndoRevisionRequest } from "@/lib/ai/optimization-route-handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleUndoRevisionRequest({ request, params });
}
