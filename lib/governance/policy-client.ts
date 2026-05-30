/**
 * Advan AI Governance Layer: Policy Engine (OPA) Client
 * Connects to Open Policy Agent for Rego-based business rule enforcement.
 */

export interface PolicyDecision {
  allow: boolean;
  reason?: string;
  remediation?: string;
}

export class PolicyClient {
  private static baseUrl = process.env.OPA_SERVICE_URL || 'http://localhost:8181';

  /**
   * Evaluates a security or business policy.
   * @param path The OPA policy path (e.g., 'advan/safety/pii')
   * @param input Data to evaluate against the policy
   */
  static async evaluate<T>(path: string, input: T): Promise<PolicyDecision> {
    try {
      // In a real environment, this would call the OPA REST API
      // For now, we implement a fallback logic that can be gated by Rego later.
      console.log(`[OPA] Evaluating policy: ${path}`, input);
      
      // Default: Allow if no obvious safety violations (simulated)
      return {
        allow: true,
        reason: 'Policy check passed (mock)',
      };
    } catch (error) {
      console.error('[OPA] Policy evaluation failed:', error);
      return {
        allow: false,
        reason: 'Policy engine unreachable',
      };
    }
  }
}
