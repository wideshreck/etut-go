import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("renders horizontal separator", () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
  });

  it("renders vertical separator", () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveAttribute(
      "data-orientation",
      "vertical",
    );
  });

  it("applies custom className", () => {
    const { container } = render(<Separator className="my-4" />);
    expect(container.firstChild).toHaveClass("my-4");
  });
});
