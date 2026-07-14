import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, LocalizedJson } from "@/types/database.types";
import { PROVIDER_VERIFICATION_BUCKET } from "@/lib/verification/constants";

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
  };
}

export async function listPendingVerificationsForAdmin(): Promise<AdminVerificationItem[]> {
  const admin = createAdminClient();

  const { data: verifications, error } = await admin
    .from("provider_verifications")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !verifications?.length) return [];

  const providerIds = verifications.map((row) => row.provider_id);
  const { data: providers } = await admin
    .from("providers")
    .select("id, name, owner_id")
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

  const items: AdminVerificationItem[] = [];

  for (const verification of verifications) {
    const provider = providerById.get(verification.provider_id);
    if (!provider) continue;

    items.push({
      id: verification.id,
      providerId: verification.provider_id,
      providerName: provider.name,
      ownerId: provider.owner_id,
      ownerEmail: emailByUserId.get(provider.owner_id) ?? "",
      ownerDisplayName: displayNameByUserId.get(provider.owner_id) ?? null,
      status: verification.status,
      rejectionReason: verification.rejection_reason,
      idFrontUrl: verification.id_front_url,
      idBackUrl: verification.id_back_url,
      selfieUrl: verification.selfie_url,
      submittedAt: verification.created_at,
    });
  }

  return items;
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
