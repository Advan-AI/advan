/**
 * Advan AI Governance Layer: Policy Engine (OPA) Client
 *
 * In production: POSTs input to the Open Policy Agent REST API at OPA_SERVICE_URL.
 * In development / when OPA is unavailable: falls back to the inline simulation
 * that mirrors the logic in the .rego policy files.
 */

export interface PolicyDecision {
  allow: boolean
  reason?: string
  remediation?: string
}

export class PolicyClient {
  private static baseUrl = process.env.OPA_SERVICE_URL ?? "http://localhost:8181"
  private static timeoutMs = 2000
  private static liveOpaUnavailable = false
  private static warnedLiveOpaUnavailable = false

  /**
   * Evaluate a policy rule.
   * @param path  - OPA policy path, e.g. "advan/safety/intent"
   * @param input - The request context passed to the Rego rule
   */
  static async evaluate<T>(path: string, input: T): Promise<PolicyDecision> {
    const useLiveOpa = Boolean(process.env.OPA_SERVICE_URL) && !this.liveOpaUnavailable

    // Try live OPA when configured and previously reachable.
    if (useLiveOpa) {
      try {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), this.timeoutMs)

        const response = await fetch(`${this.baseUrl}/v1/data/${path.replace(/\//g, "/")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
          signal: controller.signal,
        })
        clearTimeout(tid)

        if (response.ok) {
          const json = await response.json() as { result?: { allow?: boolean; reason?: string; remediation?: string } }
          const result = json.result ?? {}
          return {
            allow: result.allow ?? true,
            reason: result.reason,
            remediation: result.remediation,
          }
        }
      } catch (err) {
        this.liveOpaUnavailable = true
        if (!this.warnedLiveOpaUnavailable) {
          this.warnedLiveOpaUnavailable = true
          console.warn(
            "[OPA] Live policy evaluation unavailable, using inline fallback for this process:",
            (err as Error).message,
            `(OPA_SERVICE_URL=${process.env.OPA_SERVICE_URL})`
          )
        }
      }
    }

    // Inline simulation — mirrors the .rego policy files in lib/governance/policies/
    return this.simulatePolicy(path, input)
  }

  private static simulatePolicy<T>(path: string, input: T): PolicyDecision {
    const i = input as any

    if (path === "advan/safety/intent") {
      if (i.emergency_lock) return { allow: false, reason: "Emergency Lock active" }
      if (i.toxic) return { allow: false, reason: "Toxic content detected" }
      if (i.intent === "jailbreak") return { allow: false, reason: "Jailbreak attempt blocked" }
    }

    if (path === "advan/privacy/pii") {
      if (i.has_pii && !i.masked) {
        return { allow: false, reason: "Unmasked PII in response", remediation: "Apply PII masker" }
      }
    }

    if (path === "advan/handoff") {
      if (i.confidence !== undefined && Number(i.confidence) < 85) {
        return {
          allow: false,
          reason: `Low confidence: ${i.confidence}% (threshold: 85%)`,
          remediation: "Route to human agent via HITL queue",
        }
      }
    }

    return { allow: true, reason: "Policy check passed" }
  }
}
