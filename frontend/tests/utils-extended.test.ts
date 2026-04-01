import { describe, it, expect } from "vitest";
import { cn, maskTC } from "@/lib/utils";

describe("cn edge cases", () => {
  it("handles empty args", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });

  it("handles null", () => {
    expect(cn("a", null, "b")).toBe("a b");
  });

  it("handles array of classes", () => {
    expect(cn(["a", "b"])).toBe("a b");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles object notation", () => {
    expect(cn({ "text-red-500": true, "bg-blue-500": false })).toBe(
      "text-red-500",
    );
  });

  it("handles mixed types", () => {
    expect(cn("a", false, null, undefined, "b", { c: true, d: false })).toBe(
      "a b c",
    );
  });

  it("handles empty string", () => {
    expect(cn("", "a")).toBe("a");
  });
});

describe("maskTC edge cases", () => {
  it("masks 11-char TC", () => {
    expect(maskTC("12345678901")).toBe("123****01");
  });

  it("handles exactly 5 chars", () => {
    expect(maskTC("12345")).toBe("123****45");
  });

  it("handles 6 chars", () => {
    expect(maskTC("123456")).toBe("123****56");
  });

  it("returns original for whitespace string (truthy, short)", () => {
    expect(maskTC("   ")).toBe("   ");
  });

  it("masks 7-char string", () => {
    expect(maskTC("1234567")).toBe("123****67");
  });

  it("handles single char", () => {
    expect(maskTC("A")).toBe("A");
  });

  it("handles two chars", () => {
    expect(maskTC("AB")).toBe("AB");
  });
});
