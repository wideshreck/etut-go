import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("renders with text", () => {
    render(<Label>Email</Label>);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders with htmlFor", () => {
    render(<Label htmlFor="email">Email</Label>);
    expect(screen.getByText("Email")).toHaveAttribute("for", "email");
  });

  it("applies custom className", () => {
    render(<Label className="text-red-500">Custom</Label>);
    expect(screen.getByText("Custom")).toHaveClass("text-red-500");
  });

  it("renders as a label element", () => {
    render(<Label>Test</Label>);
    expect(screen.getByText("Test").tagName).toBe("LABEL");
  });
});
