import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withOneRetryOnFailure } from "@/domains/payment/capture";

describe("withOneRetryOnFailure (unlock grant post-paid path)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns on first success without retrying", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValue({ ok: true as const, grantId: "g-1" });

    const pending = withOneRetryOnFailure(attempt, 250);
    const result = await pending;

    expect(result).toEqual({ ok: true, grantId: "g-1" });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries once after failure and recovers on second success", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, error: "transient" })
      .mockResolvedValueOnce({ ok: true as const, grantId: "g-2" });

    const pending = withOneRetryOnFailure(attempt, 250);
    await vi.advanceTimersByTimeAsync(250);
    const result = await pending;

    expect(result).toEqual({ ok: true, grantId: "g-2" });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("returns the final error when both attempts fail", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, error: "first" })
      .mockResolvedValueOnce({ ok: false as const, error: "still_failing" });

    const pending = withOneRetryOnFailure(attempt, 250);
    await vi.advanceTimersByTimeAsync(250);
    const result = await pending;

    expect(result).toEqual({ ok: false, error: "still_failing" });
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
