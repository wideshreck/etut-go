import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

describe("Table", () => {
  it("renders with data", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ali</TableCell>
            <TableCell>ali@test.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("ali@test.com")).toBeInTheDocument();
  });

  it("renders empty table", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3}>No data</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders multiple rows", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 2</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 3</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.getByText("Row 3")).toBeInTheDocument();
  });

  it("applies custom className to TableCell", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-right">Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Value")).toHaveClass("text-right");
  });
});
