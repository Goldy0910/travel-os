import { handleOptimizationRequest } from "@/lib/ai/optimization-route-handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleOptimizationRequest({
    request,
    params,
    scenario: "change_mood",
  });
}
