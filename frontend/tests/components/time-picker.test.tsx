import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimePicker } from "@/components/ui/time-picker";

describe("TimePicker", () => {
  it("renders with placeholder", () => {
    render(<TimePicker value="" onChange={vi.fn()} placeholder="Saat" />);
    expect(screen.getByText("Saat")).toBeInTheDocument();
  });
});
