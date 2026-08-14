import { NextResponse } from "next/server"
import { getDemoStatusSnapshot } from "@/lib/sandbox/get-demo-status"
import { toPublicApiError } from "@/lib/api/sanitize-trpc-error"

/**
 * Public, read-only status endpoint for the /demo/fc-sandbox page — used for
 * the initial fetch right after starting a run. Live updates while a run is
 * in flight come from `/api/demo/fc-sandbox/stream` (SSE), not repeated
 * calls to this route.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const workflowId = new URL(req.url).searchParams.get("workflowId")?.trim()
  if (!workflowId) {
    return NextResponse.json({ error: "workflowId query param is required." }, { status: 400 })
  }

  try {
    const snapshot = await getDemoStatusSnapshot(workflowId)
    return NextResponse.json(snapshot)
  } catch (err: unknown) {
    console.error("[fc-sandbox/status]", err)
    return NextResponse.json(
      { error: toPublicApiError(err, "Could not load demo status.") },
      { status: 500 }
    )
  }
}
