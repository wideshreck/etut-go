import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge extended", () => {
  it("renders default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary");
  });

  it("renders secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");
  });

  it("renders outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toBeInTheDocument();
  });

  it("renders warning variant", () => {
    render(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Badge className="ml-2">Spaced</Badge>);
    expect(screen.getByText("Spaced")).toHaveClass("ml-2");
  });

  it("renders destructive variant with class", () => {
    render(<Badge variant="destructive">Danger</Badge>);
    expect(screen.getByText("Danger")).toHaveClass("bg-destructive");
  });

  it("renders as div element", () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText("Tag").tagName).toBe("DIV");
  });
});
