import { describe, expect, it } from "vitest";
import { defaultInboxPlacementCopies } from "@/lib/inbox-placement";

describe("defaultInboxPlacementCopies", () => {
  it("has unique ids and contiguous sort order", () => {
    const ids = defaultInboxPlacementCopies.map((copy) => copy.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(defaultInboxPlacementCopies.map((copy) => copy.sort_order)).toEqual(
      defaultInboxPlacementCopies.map((_, i) => i + 1),
    );
  });

  it("has non-empty subjects and bodies", () => {
    for (const copy of defaultInboxPlacementCopies) {
      expect(copy.subject.trim()).not.toBe("");
      expect(copy.body.trim()).not.toBe("");
    }
  });
});
