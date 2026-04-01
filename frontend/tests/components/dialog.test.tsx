import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  it("renders trigger button", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogHeader>
          <p>Dialog content</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows dialog content when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visible Title</DialogTitle>
          </DialogHeader>
          <p>Visible content</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Visible content")).toBeInTheDocument();
  });
});
