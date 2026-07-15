/**
 * Minimal payment confirmation email helper.
 * Uses Resend HTTP API when RESEND_API_KEY is set; otherwise logs (dev/staging).
 */
export async function sendPaymentApprovedEmail(input: {
  to: string;
  businessName: string;
  planLabel: string;
  amount: number;
  currency: string;
  reference: string;
  locale?: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Dalily <noreply@dalily.app>";
  const isAr = input.locale === "ar";

  const subject = isAr
    ? `تم تأكيد اشتراكك ${input.planLabel} على دليلي`
    : `Your ${input.planLabel} subscription on Dalily is confirmed`;

  const html = isAr
    ? `<p>مرحباً ${input.businessName}،</p>
       <p>تم تأكيد دفعتك واشتراك <strong>${input.planLabel}</strong> صار فعّال.</p>
       <p>المبلغ: ${input.amount} ${input.currency}<br/>المرجع: ${input.reference}</p>
       <p>دليلي</p>`
    : `<p>Hi ${input.businessName},</p>
       <p>Your payment was approved. Your <strong>${input.planLabel}</strong> subscription is now active.</p>
       <p>Amount: ${input.amount} ${input.currency}<br/>Reference: ${input.reference}</p>
       <p>— Dalily</p>`;

  if (!apiKey || !input.to) {
    console.info("[payment-email] skipped (no RESEND_API_KEY or recipient)", {
      to: input.to,
      subject,
      reference: input.reference,
    });
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: input.to, subject, html }),
    });
    if (!res.ok) {
      console.warn("[payment-email] resend failed", await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.warn("[payment-email] error", error);
    return { sent: false };
  }
}
