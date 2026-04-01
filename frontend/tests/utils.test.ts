import { describe, it, expect } from "vitest";
import { cn, maskTC } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("merges tailwind conflicts", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
  });
});

describe("maskTC", () => {
  it("masks TC number", () => {
    expect(maskTC("12345678901")).toBe("123****01");
  });

  it("handles null", () => {
    expect(maskTC(null)).toBe("-");
  });

  it("handles undefined", () => {
    expect(maskTC(undefined)).toBe("-");
  });

  it("handles empty string", () => {
    expect(maskTC("")).toBe("-");
  });

  it("handles short string", () => {
    expect(maskTC("1234")).toBe("1234");
  });
});
