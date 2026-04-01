import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { api } from "@/lib/api";

describe("ApiClient extended", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    api.setToken(null);
  });

  it("handles network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(api.get("/test")).rejects.toThrow("Network error");
  });

  it("handles non-JSON error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(api.get("/test")).rejects.toThrow("API error: 500");
  });

  it("sends correct content type for POST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.post("/test", { data: true });
    const call = mockFetch.mock.calls[0];
    expect(call[1].headers["Content-Type"]).toBe("application/json");
  });

  it("does not send auth header when no token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.get("/test");
    const call = mockFetch.mock.calls[0];
    expect(call[1].headers["Authorization"]).toBeUndefined();
  });

  it("post without body sends undefined body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.post("/test");
    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBeUndefined();
  });

  it("uses correct base URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.get("/api/v1/test");
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/api/v1/test");
  });

  it("sends JSON body for PUT", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await api.put("/test", { name: "updated" });
    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBe(JSON.stringify({ name: "updated" }));
  });

  it("handles error with detail field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Validation failed" }),
    });
    await expect(api.get("/test")).rejects.toThrow("Validation failed");
  });

  it("sets and clears token", async () => {
    api.setToken("my-token");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.get("/test");
    expect(mockFetch.mock.calls[0][1].headers["Authorization"]).toBe(
      "Bearer my-token",
    );

    api.setToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await api.get("/test");
    expect(mockFetch.mock.calls[1][1].headers["Authorization"]).toBeUndefined();
  });
});
