import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getClaims = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser,
      getClaims,
      updateUser,
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  redirect: vi.fn(),
}));

import { updatePasswordAction } from "@/actions/auth.actions";
import { amrIncludesRecovery } from "@/lib/auth/password-recovery";

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("amrIncludesRecovery", () => {
  it("detects object-form recovery AMR", () => {
    expect(
      amrIncludesRecovery([{ method: "recovery", timestamp: 1 }]),
    ).toBe(true);
  });

  it("detects string-form recovery AMR", () => {
    expect(amrIncludesRecovery(["password", "recovery"])).toBe(true);
  });

  it("rejects ordinary password sessions", () => {
    expect(amrIncludesRecovery([{ method: "password", timestamp: 1 }])).toBe(
      false,
    );
    expect(amrIncludesRecovery(["password", "token_refresh"])).toBe(false);
    expect(amrIncludesRecovery(undefined)).toBe(false);
  });
});

describe("updatePasswordAction", () => {
  beforeEach(() => {
    getUser.mockReset();
    getClaims.mockReset();
    updateUser.mockReset();
  });

  it("returns session_required when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await updatePasswordAction(
      { success: false },
      form({ password: "newpass1", confirmPassword: "newpass1" }),
    );

    expect(result).toEqual({ success: false, error: "session_required" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows passwordless update for a fresh recovery session (amr recovery)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [{ method: "recovery", timestamp: 1715766000 }],
        },
      },
      error: null,
    });
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await updatePasswordAction(
      { success: false },
      form({ password: "newpass1", confirmPassword: "newpass1" }),
    );

    expect(result).toEqual({ success: true, message: "password_updated" });
    expect(updateUser).toHaveBeenCalledWith({ password: "newpass1" });
    expect(updateUser.mock.calls[0][0]).not.toHaveProperty("current_password");
  });

  it("rejects ordinary logged-in session without current password (reauth_required)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [{ method: "password", timestamp: 1715766000 }],
        },
      },
      error: null,
    });

    const result = await updatePasswordAction(
      { success: false },
      form({ password: "newpass1", confirmPassword: "newpass1" }),
    );

    expect(result).toEqual({ success: false, error: "reauth_required" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows ordinary session when current password is provided", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [{ method: "password", timestamp: 1715766000 }],
        },
      },
      error: null,
    });
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });

    const result = await updatePasswordAction(
      { success: false },
      form({
        currentPassword: "oldpass1",
        password: "newpass1",
        confirmPassword: "newpass1",
      }),
    );

    expect(result).toEqual({ success: true, message: "password_updated" });
    expect(updateUser).toHaveBeenCalledWith({
      password: "newpass1",
      current_password: "oldpass1",
    });
  });
});
