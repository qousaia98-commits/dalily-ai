import { createClient } from "@/lib/supabase/server";

export async function getConversationIdForRequest(
  requestId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("service_request_id", requestId)
    .maybeSingle();
  return data?.id ?? null;
}
