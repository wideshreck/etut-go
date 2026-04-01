import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders with placeholder", () => {
    render(<Textarea placeholder="Enter text..." />);
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
  });

  it("renders with rows", () => {
    render(<Textarea rows={5} placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toHaveAttribute("rows", "5");
  });

  it("is disabled when disabled prop set", () => {
    render(<Textarea disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Textarea className="my-class" placeholder="Custom" />);
    expect(screen.getByPlaceholderText("Custom")).toHaveClass("my-class");
  });

  it("renders as textarea element", () => {
    render(<Textarea placeholder="Tag" />);
    expect(screen.getByPlaceholderText("Tag").tagName).toBe("TEXTAREA");
  });
});
