import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, LocalizedJson } from "@/types/database.types";
import { PROVIDER_VERIFICATION_BUCKET } from "@/lib/verification/constants";
import { getLocalizedField } from "@/types/provider.types";

export type ProviderVerificationStatus = Database["public"]["Enums"]["provider_verification_status"];

export type ProviderVerificationRow = Database["public"]["Tables"]["provider_verifications"]["Row"];

export type BusinessVerificationView = {
  id: string;
  providerId: string;
  status: ProviderVerificationStatus | null;
  rejectionReason: string | null;
  idFrontUploaded: boolean;
  idBackUploaded: boolean;
  selfieUploaded: boolean;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminVerificationItem = {
  id: string;
  providerId: string;
  providerName: LocalizedJson;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
  status: ProviderVerificationStatus;
  rejectionReason: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  submittedAt: string;
};

export async function getApprovedProviderIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_verifications")
    .select("provider_id")
    .eq("status", "approved");

  return new Set((data ?? []).map((row) => row.provider_id));
}

export async function getProviderVerificationForOwner(
  providerId: string,
): Promise<ProviderVerificationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_verifications")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();

  return data ?? null;
}

export function toBusinessVerificationView(
  row: ProviderVerificationRow | null,
): BusinessVerificationView {
  if (!row) {
    return {
      id: "",
      providerId: "",
      status: null,
      rejectionReason: null,
      idFrontUploaded: false,
      idBackUploaded: false,
      selfieUploaded: false,
      reviewedAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: row.id,
    providerId: row.provider_id,
    status: row.status,
    rejectionReason: row.rejection_reason,
    idFrontUploaded: Boolean(row.id_front_url),
    idBackUploaded: Boolean(row.id_back_url),
    selfieUploaded: Boolean(row.selfie_url),
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listVerificationsForAdmin(params: {
  search?: string;
  status?: ProviderVerificationStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminVerificationItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const admin = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = params.status ?? "pending";

  let query = admin.from("provider_verifications").select("*", { count: "exact" });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query.order("created_at", { ascending: false });

  const term = params.search?.trim().toLowerCase();

  let verifications;
  let count: number | null = 0;

  if (term) {
    const { data, error } = await query;
    if (error || !data?.length) {
      return { items: [], total: 0, page, pageSize };
    }
    verifications = data;
    count = data.length;
  } else {
    const { data, count: total, error } = await query.range(from, to);
    if (error || !data?.length) {
      return { items: [], total: total ?? 0, page, pageSize };
    }
    verifications = data;
    count = total;
  }

  const providerIds = verifications.map((row) => row.provider_id);
  const { data: providers } = await admin
    .from("providers")
    .select("id, name, owner_id, slug")
    .in("id", providerIds)
    .is("deleted_at", null);

  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const ownerIds = [...new Set((providers ?? []).map((provider) => provider.owner_id))];

  const [{ data: users }, { data: profiles }] = await Promise.all([
    admin.from("users").select("id, email").in("id", ownerIds),
    admin.from("profiles").select("user_id, display_name").in("user_id", ownerIds),
  ]);

  const emailByUserId = new Map((users ?? []).map((user) => [user.id, user.email]));
  const displayNameByUserId = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile.display_name]),
  );

  const allItems: AdminVerificationItem[] = [];

  for (const verification of verifications) {
    const provider = providerById.get(verification.provider_id);
    if (!provider) continue;

    const providerName = getLocalizedField(provider.name as LocalizedJson, "en");
    const ownerEmail = emailByUserId.get(provider.owner_id) ?? "";
    const ownerName = displayNameByUserId.get(provider.owner_id) ?? "";

    if (term) {
      const haystack = `${providerName} ${provider.slug} ${ownerEmail} ${ownerName}`.toLowerCase();
      if (!haystack.includes(term)) continue;
    }

    allItems.push({
      id: verification.id,
      providerId: verification.provider_id,
      providerName: provider.name as LocalizedJson,
      ownerId: provider.owner_id,
      ownerEmail,
      ownerDisplayName: displayNameByUserId.get(provider.owner_id) ?? null,
      status: verification.status,
      rejectionReason: verification.rejection_reason,
      idFrontUrl: verification.id_front_url,
      idBackUrl: verification.id_back_url,
      selfieUrl: verification.selfie_url,
      submittedAt: verification.created_at,
    });
  }

  const total = term ? allItems.length : (count ?? allItems.length);
  const items = term ? allItems.slice(from, from + pageSize) : allItems;

  return {
    items,
    total,
    page,
    pageSize,
  };
}

/** @deprecated Use listVerificationsForAdmin with status pending */
export async function listPendingVerificationsForAdmin(): Promise<AdminVerificationItem[]> {
  const result = await listVerificationsForAdmin({ status: "pending", pageSize: 100 });
  return result.items;
}

export async function createSignedVerificationUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PROVIDER_VERIFICATION_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function isVerificationComplete(row: ProviderVerificationRow | null): boolean {
  if (!row) return false;
  return Boolean(row.id_front_url && row.id_back_url && row.selfie_url);
}
