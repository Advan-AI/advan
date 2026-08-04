import { describe, it, expect } from "vitest";
import { chunkText } from "./ingestion";
import { parseOSSKey, buildOSSKey } from "./oss-client";

describe("Alibaba Ingestion & OSS Key Utilities", () => {
  it("should format and parse org-scoped OSS keys accurately", () => {
    const orgId = "org-uuid-1234";
    const filename = "user-guide.pdf";

    const key = buildOSSKey(orgId, filename);
    expect(key).toBe("org-uuid-1234/knowledge-docs/user-guide.pdf");

    const parsed = parseOSSKey(key);
    expect(parsed).not.toBeNull();
    expect(parsed?.orgId).toBe("org-uuid-1234");
    expect(parsed?.filename).toBe("user-guide.pdf");
  });

  it("should chunk long text with appropriate size and overlap", () => {
    const text = "Sentence 1. ".repeat(100); // 1200 chars
    const chunks = chunkText(text, 500, 50);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(550);
    }
  });
});
