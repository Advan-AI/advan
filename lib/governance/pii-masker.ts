/**
 * Advan AI Governance Layer: PII Masking Utility
 * Implements Microsoft Presidio logic patterns for data safety.
 */

const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
};

export class PIIMasker {
  /**
   * Masks sensitive information in a string.
   * In production, this can be offloaded to a Microsoft Presidio sidecar.
   */
  static mask(text: string): string {
    let masked = text;
    
    masked = masked.replace(PII_PATTERNS.EMAIL, '[EMAIL]');
    masked = masked.replace(PII_PATTERNS.PHONE, '[PHONE]');
    masked = masked.replace(PII_PATTERNS.CREDIT_CARD, '[CREDIT_CARD]');
    masked = masked.replace(PII_PATTERNS.SSN, '[SSN]');
    
    return masked;
  }

  /**
   * Validates if a string contains any unmasked PII.
   */
  static hasPII(text: string): boolean {
    return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
  }
}
