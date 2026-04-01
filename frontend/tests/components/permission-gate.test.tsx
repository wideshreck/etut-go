import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock useAuth
vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/auth-context";
import { PermissionGate } from "@/components/permission-gate";

const mockedUseAuth = vi.mocked(useAuth);

describe("PermissionGate", () => {
  it("shows children when permission granted", () => {
    mockedUseAuth.mockReturnValue({
      hasPermission: () => true,
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <PermissionGate permission="teachers.view">
        <p>Visible</p>
      </PermissionGate>,
    );
    expect(screen.getByText("Visible")).toBeInTheDocument();
  });

  it("hides children when permission denied", () => {
    mockedUseAuth.mockReturnValue({
      hasPermission: () => false,
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <PermissionGate permission="teachers.delete">
        <p>Hidden</p>
      </PermissionGate>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("shows fallback when permission denied", () => {
    mockedUseAuth.mockReturnValue({
      hasPermission: () => false,
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <PermissionGate permission="teachers.delete" fallback={<p>No access</p>}>
        <p>Hidden</p>
      </PermissionGate>,
    );
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
