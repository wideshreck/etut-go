import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button extended", () => {
  it("calls onClick handler", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByText("Click"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    await user.click(screen.getByText("Disabled"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders outline variant", () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByText("Outline")).toHaveClass("border");
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText("Ghost")).toBeInTheDocument();
  });

  it("renders link variant", () => {
    render(<Button variant="link">Link</Button>);
    expect(screen.getByText("Link")).toHaveClass("underline-offset-4");
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");
  });

  it("renders icon size", () => {
    render(<Button size="icon">X</Button>);
    expect(screen.getByText("X")).toHaveClass("h-9", "w-9");
  });

  it("renders lg size", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByText("Large")).toHaveClass("h-10");
  });

  it("renders as button element", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByText("Submit").tagName).toBe("BUTTON");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByText("Custom")).toHaveClass("custom-class");
  });
});
