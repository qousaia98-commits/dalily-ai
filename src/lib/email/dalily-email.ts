/**
 * Transactional emails for Dalily (Resend HTTP API).
 * Without RESEND_API_KEY, messages are logged and skipped (dev/staging safe).
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  tag?: string;
};

async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Dalily <noreply@dalily.app>";

  if (!apiKey || !input.to) {
    console.info("[dalily-email] skipped (no RESEND_API_KEY or recipient)", {
      tag: input.tag,
      to: input.to,
      subject: input.subject,
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
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      console.warn("[dalily-email] resend failed", await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.warn("[dalily-email] error", error);
    return { sent: false };
  }
}

type LocaleInput = {
  to: string;
  businessName: string;
  locale?: string;
};

export async function sendBusinessApprovedEmail(input: LocaleInput) {
  const isAr = input.locale === "ar";
  return sendEmail({
    tag: "business_approved",
    to: input.to,
    subject: isAr
      ? `تم اعتماد نشاطك على دليلي — ${input.businessName}`
      : `Your business was approved on Dalily — ${input.businessName}`,
    html: isAr
      ? `<p>مرحباً ${input.businessName}،</p>
         <p>تمت الموافقة على نشاطك. لوحة التحكم وخطط الاشتراك (Starter / PRO / PREMIUM) أصبحت متاحة الآن.</p>
         <p>دليلي</p>`
      : `<p>Hi ${input.businessName},</p>
         <p>Your business has been approved. Your dashboard and subscription plans (Starter / PRO / PREMIUM) are now unlocked.</p>
         <p>— Dalily</p>`,
  });
}

export async function sendBusinessRejectedEmail(
  input: LocaleInput & { reason?: string },
) {
  const isAr = input.locale === "ar";
  const reasonBlock = input.reason
    ? isAr
      ? `<p>السبب: ${input.reason}</p>`
      : `<p>Reason: ${input.reason}</p>`
    : "";
  return sendEmail({
    tag: "business_rejected",
    to: input.to,
    subject: isAr
      ? `لم تتم الموافقة على نشاطك — ${input.businessName}`
      : `Your business was not approved — ${input.businessName}`,
    html: isAr
      ? `<p>مرحباً ${input.businessName}،</p>
         <p>لم نتمكن من اعتماد نشاطك حالياً. يمكنك تحديث الملف وإعادة الإرسال للمراجعة.</p>
         ${reasonBlock}
         <p>دليلي</p>`
      : `<p>Hi ${input.businessName},</p>
         <p>We could not approve your business at this time. You can update your profile and resubmit for review.</p>
         ${reasonBlock}
         <p>— Dalily</p>`,
  });
}

export async function sendBusinessChangesRequestedEmail(
  input: LocaleInput & { note: string },
) {
  const isAr = input.locale === "ar";
  return sendEmail({
    tag: "business_changes_requested",
    to: input.to,
    subject: isAr
      ? `مطلوب تعديلات على نشاطك — ${input.businessName}`
      : `Changes requested for your business — ${input.businessName}`,
    html: isAr
      ? `<p>مرحباً ${input.businessName}،</p>
         <p>راجع فريق دليلي طلبك ويحتاج تعديلات قبل الموافقة.</p>
         <p><strong>المطلوب:</strong><br/>${input.note}</p>
         <p>حدّث ملفك وأعد الإرسال للمراجعة.</p>
         <p>دليلي</p>`
      : `<p>Hi ${input.businessName},</p>
         <p>Our team reviewed your submission and needs a few changes before approval.</p>
         <p><strong>Please complete:</strong><br/>${input.note}</p>
         <p>Update your profile and resubmit for review.</p>
         <p>— Dalily</p>`,
  });
}

export async function sendPlanActivatedEmail(
  input: LocaleInput & {
    planLabel: "PRO" | "PREMIUM";
    amount: number;
    currency: string;
    reference: string;
  },
) {
  const isAr = input.locale === "ar";
  return sendEmail({
    tag: input.planLabel === "PREMIUM" ? "premium_activated" : "pro_activated",
    to: input.to,
    subject: isAr
      ? `تم تفعيل اشتراك ${input.planLabel} — ${input.businessName}`
      : `Your ${input.planLabel} plan is now active — ${input.businessName}`,
    html: isAr
      ? `<p>مرحباً ${input.businessName}،</p>
         <p>تم تأكيد دفعتك واشتراك <strong>${input.planLabel}</strong> صار فعّال.</p>
         <p>المبلغ: ${input.amount} ${input.currency}<br/>المرجع: ${input.reference}</p>
         <p>دليلي</p>`
      : `<p>Hi ${input.businessName},</p>
         <p>Your payment was approved. Your <strong>${input.planLabel}</strong> subscription is now active.</p>
         <p>Amount: ${input.amount} ${input.currency}<br/>Reference: ${input.reference}</p>
         <p>— Dalily</p>`,
  });
}

/** @deprecated Prefer sendPlanActivatedEmail */
export async function sendPaymentApprovedEmail(input: {
  to: string;
  businessName: string;
  planLabel: string;
  amount: number;
  currency: string;
  reference: string;
  locale?: string;
}) {
  const planLabel = input.planLabel === "PREMIUM" ? "PREMIUM" : "PRO";
  return sendPlanActivatedEmail({
    to: input.to,
    businessName: input.businessName,
    planLabel,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    locale: input.locale,
  });
}

export async function sendPaymentRejectedEmail(
  input: LocaleInput & {
    planLabel: string;
    amount: number;
    currency: string;
    reference: string;
    adminNote?: string;
  },
) {
  const isAr = input.locale === "ar";
  const noteBlock = input.adminNote
    ? isAr
      ? `<p>ملاحظة الإدارة: ${input.adminNote}</p>`
      : `<p>Admin note: ${input.adminNote}</p>`
    : "";
  return sendEmail({
    tag: "payment_rejected",
    to: input.to,
    subject: isAr
      ? `تعذّر التحقق من الدفع — ${input.businessName}`
      : `Payment could not be verified — ${input.businessName}`,
    html: isAr
      ? `<p>مرحباً ${input.businessName}،</p>
         <p>لم نتمكن من تأكيد دفعتك لخطة <strong>${input.planLabel}</strong>.</p>
         <p>المبلغ: ${input.amount} ${input.currency}<br/>المرجع: ${input.reference}</p>
         ${noteBlock}
         <p>يمكنك إعادة المحاولة من لوحة الاشتراك.</p>
         <p>دليلي</p>`
      : `<p>Hi ${input.businessName},</p>
         <p>We could not verify your payment for the <strong>${input.planLabel}</strong> plan.</p>
         <p>Amount: ${input.amount} ${input.currency}<br/>Reference: ${input.reference}</p>
         ${noteBlock}
         <p>You can try again from your subscription page.</p>
         <p>— Dalily</p>`,
  });
}
