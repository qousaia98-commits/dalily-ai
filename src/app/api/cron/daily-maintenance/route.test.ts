import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processCompletionPrompts: vi.fn(),
  processSmartBookingReminders: vi.fn(),
  resetMonthlyIncludedUnlocks: vi.fn(),
  processRecurringSchedules: vi.fn(),
  processRecurringReminders: vi.fn(),
  optimizeRecurringRoutes: vi.fn(),
  processUnlockSlaTimeouts: vi.fn(),
  cleanupExpiredMobileBridgeCodes: vi.fn(),
  isProviderMonetizationEnabled: vi.fn(() => true),
  isRecurringServicesEnabled: vi.fn(() => true),
  isUnlockV2Enabled: vi.fn(() => true),
}));

vi.mock("@/lib/booking/completion-service", () => ({
  processCompletionPrompts: mocks.processCompletionPrompts,
}));

vi.mock("@/lib/booking/smart/reminders", () => ({
  processSmartBookingReminders: mocks.processSmartBookingReminders,
}));

vi.mock("@/lib/monetization", () => ({
  resetMonthlyIncludedUnlocks: mocks.resetMonthlyIncludedUnlocks,
}));

vi.mock("@/lib/recurring", () => ({
  processRecurringSchedules: mocks.processRecurringSchedules,
  processRecurringReminders: mocks.processRecurringReminders,
  optimizeRecurringRoutes: mocks.optimizeRecurringRoutes,
}));

vi.mock("@/domains/unlock/fallback", () => ({
  processUnlockSlaTimeouts: mocks.processUnlockSlaTimeouts,
}));

vi.mock("@/lib/auth/mobile-bridge", () => ({
  cleanupExpiredMobileBridgeCodes: mocks.cleanupExpiredMobileBridgeCodes,
}));

vi.mock("@/lib/config/feature-flags", () => ({
  isProviderMonetizationEnabled: mocks.isProviderMonetizationEnabled,
  isRecurringServicesEnabled: mocks.isRecurringServicesEnabled,
  isUnlockV2Enabled: mocks.isUnlockV2Enabled,
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/observability/capture", () => ({
  captureException: vi.fn(),
}));

import { GET, POST } from "./route";
import { runDailyMaintenanceJobs } from "./jobs";

function requestWithAuth(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("http://localhost/api/cron/daily-maintenance", {
    method: "POST",
    headers,
  });
}

describe("daily-maintenance cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;

    mocks.processCompletionPrompts.mockResolvedValue({ prompted: 0 });
    mocks.processSmartBookingReminders.mockResolvedValue({ sent: 0 });
    mocks.resetMonthlyIncludedUnlocks.mockResolvedValue({ reset: 0 });
    mocks.processRecurringSchedules.mockResolvedValue({ generated: 0 });
    mocks.processRecurringReminders.mockResolvedValue({ sent: 0 });
    mocks.optimizeRecurringRoutes.mockResolvedValue([]);
    mocks.processUnlockSlaTimeouts.mockResolvedValue({ timedOut: 0 });
    mocks.cleanupExpiredMobileBridgeCodes.mockResolvedValue(0);

    mocks.isProviderMonetizationEnabled.mockReturnValue(true);
    mocks.isRecurringServicesEnabled.mockReturnValue(true);
    mocks.isUnlockV2Enabled.mockReturnValue(true);
  });

  it("rejects unauthorized requests when CRON_SECRET is missing (500)", async () => {
    const res = await POST(requestWithAuth("anything"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "cron_secret_missing" });
    expect(mocks.processCompletionPrompts).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests with wrong bearer (401)", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const res = await GET(requestWithAuth("wrong-secret"));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
    expect(mocks.processCompletionPrompts).not.toHaveBeenCalled();
  });

  it("continues remaining jobs when one service throws", async () => {
    process.env.CRON_SECRET = "correct-secret";
    mocks.processCompletionPrompts.mockRejectedValue(new Error("completion boom"));

    const res = await POST(requestWithAuth("correct-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          job: "booking-completion",
          status: "error",
          error: "completion boom",
        }),
        expect.objectContaining({ job: "booking-reminders", status: "ok" }),
        expect.objectContaining({ job: "monetization-reset", status: "ok" }),
        expect.objectContaining({ job: "recurring-schedules", status: "ok" }),
        expect.objectContaining({ job: "recurring-reminders", status: "ok" }),
        expect.objectContaining({ job: "recurring-routes", status: "ok" }),
        expect.objectContaining({ job: "unlock-sla", status: "ok" }),
        expect.objectContaining({
          job: "mobile-bridge-cleanup",
          status: "ok",
        }),
      ]),
    );

    expect(mocks.processCompletionPrompts).toHaveBeenCalledTimes(1);
    expect(mocks.processSmartBookingReminders).toHaveBeenCalledTimes(1);
    expect(mocks.resetMonthlyIncludedUnlocks).toHaveBeenCalledTimes(1);
    expect(mocks.processRecurringSchedules).toHaveBeenCalledTimes(1);
    expect(mocks.processRecurringReminders).toHaveBeenCalledTimes(1);
    expect(mocks.optimizeRecurringRoutes).toHaveBeenCalledTimes(1);
    expect(mocks.processUnlockSlaTimeouts).toHaveBeenCalledTimes(1);
    expect(mocks.cleanupExpiredMobileBridgeCodes).toHaveBeenCalledTimes(1);
  });

  it("does not call processCompletionPrompts twice (deduped from reminders)", async () => {
    const jobs = await runDailyMaintenanceJobs();
    expect(mocks.processCompletionPrompts).toHaveBeenCalledTimes(1);
    expect(mocks.processSmartBookingReminders).toHaveBeenCalledTimes(1);
    expect(jobs.map((j) => j.job)).toEqual([
      "booking-completion",
      "booking-reminders",
      "monetization-reset",
      "recurring-schedules",
      "recurring-reminders",
      "recurring-routes",
      "unlock-sla",
      "mobile-bridge-cleanup",
    ]);
  });
});
