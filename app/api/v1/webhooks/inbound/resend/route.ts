import { handleInboundRequest } from "@/app/api/webhooks/resend/inbound/route"

export const runtime = "nodejs"

export function POST(req: Request): Promise<Response> {
  return handleInboundRequest(req)
}
