/**
 * Admin automation — detect issues and recommend actions.
 * Never auto-suspend providers or touch payments.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkflow } from "./registry";
import { runWorkflow } from "./engine";
import type { AutomationSuggestion, WorkflowRunResult } from "./types";

function toSuggestion(
  run: WorkflowRunResult,
  titles: { en: string; ar: string },
  recommendedAdminActions: string[],
): AutomationSuggestion {
  return {
    id: run.actionId ?? undefined,
    workflowId: run.workflowId,
    actionType: run.workflowId.split(".").pop() ?? run.workflowId,
    titleEn: titles.en,
    titleAr: titles.ar,
    bodyEn: run.reasonEn,
    bodyAr: run.reasonAr,
    confidence: run.confidence,
    decisionMode: run.decisionMode,
    status: run.status,
    reasonEn: run.reasonEn,
    reasonAr: run.reasonAr,
    dataSources: run.dataSources,
    reversible: run.reversible,
    payload: { ...run.result, recommendedAdminActions },
  };
}

export async function runAdminAutomations(): Promise<AutomationSuggestion[]> {
  const out: AutomationSuggestion[] = [];
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const sinceIso = since.toISOString();

  // Spam heuristic: many requests from same customer in short window
  try {
    const { data: recent } = await admin
      .from("service_requests")
      .select("id, customer_id, title, created_at")
      .gte("created_at", sinceIso)
      .limit(2000);

    const byCustomer = new Map<string, number>();
    for (const r of recent ?? []) {
      const cid = String(r.customer_id);
      byCustomer.set(cid, (byCustomer.get(cid) ?? 0) + 1);
    }
    const spamSuspects = [...byCustomer.entries()].filter(([, n]) => n >= 8);
    if (spamSuspects.length > 0) {
      const wf = getWorkflow("admin.detect_spam")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "burst_requests",
            satisfied: true,
            noteEn: `${spamSuspects.length} customers with ≥8 requests/7d`,
          },
        ],
        confidence: Math.min(0.97, 0.8 + spamSuspects.length * 0.02),
        reasonEn: `Possible spam: ${spamSuspects.length} customer(s) with request bursts.`,
        reasonAr: `احتمال إزعاج: ${spamSuspects.length} زبون(زبائن) بطلبات متكررة.`,
        dataSources: ["service_requests.created_at", "customer_id"],
        payload: {
          suspects: spamSuspects.slice(0, 10).map(([id, n]) => ({ id, n })),
        },
      });
      out.push(
        toSuggestion(
          run,
          { en: "Spam candidates", ar: "مرشحو إزعاج" },
          ["review_customer_activity", "rate_limit_intake"],
        ),
      );
    }

    // Duplicates: same customer + similar title within 24h
    const titles = new Map<string, string[]>();
    for (const r of recent ?? []) {
      const key = `${r.customer_id}|${String(r.title ?? "")
        .toLowerCase()
        .slice(0, 40)}`;
      const arr = titles.get(key) ?? [];
      arr.push(String(r.id));
      titles.set(key, arr);
    }
    const dupes = [...titles.entries()].filter(([, ids]) => ids.length >= 2);
    if (dupes.length > 0) {
      const wf = getWorkflow("admin.detect_duplicates")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "duplicate_titles",
            satisfied: true,
            noteEn: `${dupes.length} duplicate clusters`,
          },
        ],
        confidence: 0.89,
        reasonEn: `Found ${dupes.length} likely duplicate job cluster(s).`,
        reasonAr: `عُثر على ${dupes.length} مجموعة طلبات مكررة محتملة.`,
        dataSources: ["service_requests.title", "customer_id"],
        payload: {
          clusters: dupes.slice(0, 8).map(([k, ids]) => ({ key: k, ids })),
        },
      });
      out.push(
        toSuggestion(
          run,
          { en: "Duplicate jobs", ar: "طلبات مكررة" },
          ["merge_or_close_duplicates"],
        ),
      );
    }
  } catch {
    // soft fail
  }

  // Inactive providers
  try {
    const { data: providers } = await admin
      .from("providers")
      .select("id, updated_at, status")
      .eq("status", "active")
      .limit(500);

    const cutoff = Date.now() - 30 * 24 * 3600_000;
    const inactive = (providers ?? []).filter((p) => {
      const t = p.updated_at ? new Date(p.updated_at as string).getTime() : 0;
      return t > 0 && t < cutoff;
    });
    if (inactive.length > 0) {
      const wf = getWorkflow("admin.detect_inactive_providers")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "stale_profile",
            satisfied: true,
            noteEn: `${inactive.length} inactive 30d+`,
          },
        ],
        confidence: 0.85,
        reasonEn: `${inactive.length} active provider(s) with no profile activity in 30+ days.`,
        reasonAr: `${inactive.length} مزود(ون) نشطون بلا نشاط ملف لأكثر من 30 يوماً.`,
        dataSources: ["providers.updated_at", "providers.status"],
        payload: { count: inactive.length },
      });
      out.push(
        toSuggestion(
          run,
          { en: "Inactive providers", ar: "مزودون غير نشطين" },
          ["send_reengagement", "review_listing"],
        ),
      );
    }
  } catch {
    // soft
  }

  // Response delays
  try {
    const { data: slow } = await admin
      .from("service_requests")
      .select("id, response_time_seconds")
      .not("response_time_seconds", "is", null)
      .gte("created_at", sinceIso)
      .limit(500);

    const delayed = (slow ?? []).filter(
      (r) => Number(r.response_time_seconds) > 6 * 3600,
    );
    if (delayed.length >= 3) {
      const wf = getWorkflow("admin.detect_response_delays")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "slow_responses",
            satisfied: true,
            noteEn: `${delayed.length} responses >6h`,
          },
        ],
        confidence: 0.87,
        reasonEn: `${delayed.length} requests with response time over 6 hours.`,
        reasonAr: `${delayed.length} طلبات بزمن رد أكثر من 6 ساعات.`,
        dataSources: ["service_requests.response_time_seconds"],
        payload: { count: delayed.length },
      });
      out.push(
        toSuggestion(
          run,
          { en: "Large response delays", ar: "تأخير كبير في الرد" },
          ["nudge_providers", "expand_dispatch_radius"],
        ),
      );
    }
  } catch {
    // soft
  }

  // Suspicious: very low ratings burst — soft heuristic via trust if available
  try {
    const { count } = await admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .lt("trust_score", 20)
      .eq("status", "active");

    if ((count ?? 0) > 0) {
      const wf = getWorkflow("admin.detect_suspicious")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "low_trust",
            satisfied: true,
            noteEn: `${count} low-trust active`,
          },
        ],
        confidence: 0.76,
        reasonEn: `${count} active provider(s) with very low trust scores — review manually.`,
        reasonAr: `${count} مزود(ون) نشطون بثقة منخفضة جداً — راجع يدوياً.`,
        dataSources: ["providers.trust_score"],
        payload: { count },
        // Never auto-suspend
      });
      out.push(
        toSuggestion(
          run,
          { en: "Suspicious behaviour signals", ar: "إشارات سلوك مشبوه" },
          ["manual_review", "request_identity_check"],
        ),
      );
    }
  } catch {
    // soft
  }

  // Marketplace shortages — reuse balancer if available
  try {
    const { detectMarketplaceBalances } = await import(
      "@/lib/ai/predictive/balancer"
    );
    const balances = await detectMarketplaceBalances();
    const shortages = balances.filter(
      (b) =>
        b.severity === "shortage" || b.severity === "critical_shortage",
    );
    if (shortages.length > 0) {
      const wf = getWorkflow("admin.detect_shortages")!;
      const run = await runWorkflow({
        workflow: wf,
        triggerKey: "admin_scan",
        conditions: [
          {
            key: "shortage",
            satisfied: true,
            noteEn: `${shortages.length} shortage buckets`,
          },
        ],
        confidence: 0.9,
        reasonEn: `Marketplace shortage in ${shortages.length} categor(y/ies).`,
        reasonAr: `نقص في السوق ضمن ${shortages.length} فئة/فئات.`,
        dataSources: ["ai_marketplace_balances", "predictive.balancer"],
        payload: {
          categories: shortages.map((s) => s.categorySlug).slice(0, 8),
        },
      });
      out.push(
        toSuggestion(
          run,
          { en: "Marketplace shortages", ar: "نقص في السوق" },
          [
            "expand_radius",
            "increase_provider_pool",
            "priority_dispatch",
            "public_marketplace",
          ],
        ),
      );
    }
  } catch {
    // predictive may be off
  }

  return out;
}
