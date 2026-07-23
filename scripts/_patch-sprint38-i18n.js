const fs = require("fs");

function patch(file, mutator) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  mutator(data);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

patch("messages/en.json", (d) => {
  d.booking.status.awaiting_customer_confirmation = "Awaiting your confirmation";
  d.booking.status.customer_confirmed = "Customer confirmed";
  d.booking.status.issue_reported = "Issue reported";
  d.booking.actions.requestConfirmation = "Ask customer to confirm";
  d.booking.actions.openChat = "Open chat";
  d.booking.completion = {
    title: "Has your service been completed?",
    subtitle: "Only you can confirm completion. This unlocks reviews.",
    yes: "Yes, it was completed",
    no: "No, there was a problem",
    whatHappened: "What happened?",
    submit: "Submit",
    issueReportedTitle: "Issue reported",
    issueReportedBody:
      "Your booking stays active and chat stays open. You can reschedule or confirm later if the work was finished.",
    continueChat: "Continue chat",
    confirmAnyway: "Mark as completed now",
    reasons: {
      provider_never_arrived: "Provider never arrived",
      provider_cancelled: "Provider cancelled",
      work_incomplete: "Work not finished",
      poor_quality: "Poor quality",
      need_another_visit: "Need another appointment",
      other: "Other",
    },
    errors: {
      update_failed: "Could not save your answer.",
      forbidden: "You cannot confirm this booking.",
      not_found: "Booking not found.",
      invalid_status: "This booking cannot be confirmed right now.",
      validation_error: "Please choose a reason.",
      login_required: "Please log in.",
    },
  };
  d.notifications.bookingCompletionPrompt = {
    title: "Was the service completed?",
    body: "Your appointment time has passed. Confirm completion or report an issue.",
  };
  d.notifications.bookingCustomerConfirmed = {
    title: "Customer confirmed completion",
    body: "The customer confirmed that the service was completed.",
  };
  d.notifications.bookingIssueReported = {
    title: "Customer reported an issue",
    body: "A customer reported a problem with an appointment. Chat stays open.",
  };
});

patch("messages/ar.json", (d) => {
  d.booking.status.awaiting_customer_confirmation = "بانتظار تأكيدك";
  d.booking.status.customer_confirmed = "أكد العميل";
  d.booking.status.issue_reported = "تم الإبلاغ عن مشكلة";
  d.booking.actions.requestConfirmation = "اطلب تأكيد العميل";
  d.booking.actions.openChat = "فتح المحادثة";
  d.booking.completion = {
    title: "هل اكتملت الخدمة؟",
    subtitle: "أنت فقط من يؤكد الإتمام. هذا يفتح التقييمات.",
    yes: "نعم، اكتملت",
    no: "لا، هناك مشكلة",
    whatHappened: "ماذا حدث؟",
    submit: "إرسال",
    issueReportedTitle: "تم الإبلاغ عن مشكلة",
    issueReportedBody:
      "يبقى الحجز نشطاً والمحادثة مفتوحة. يمكنك إعادة الجدولة أو التأكيد لاحقاً إذا اكتمل العمل.",
    continueChat: "متابعة المحادثة",
    confirmAnyway: "تعليم كمكتمل الآن",
    reasons: {
      provider_never_arrived: "لم يصل مزود الخدمة",
      provider_cancelled: "ألغى مزود الخدمة",
      work_incomplete: "العمل لم يكتمل",
      poor_quality: "جودة ضعيفة",
      need_another_visit: "أحتاج موعداً آخر",
      other: "أخرى",
    },
    errors: {
      update_failed: "تعذر حفظ إجابتك.",
      forbidden: "لا يمكنك تأكيد هذا الحجز.",
      not_found: "الحجز غير موجود.",
      invalid_status: "لا يمكن تأكيد هذا الحجز الآن.",
      validation_error: "يرجى اختيار سبب.",
      login_required: "يرجى تسجيل الدخول.",
    },
  };
  d.notifications.bookingCompletionPrompt = {
    title: "هل اكتملت الخدمة؟",
    body: "انتهى موعدك. أكّد الإتمام أو أبلغ عن مشكلة.",
  };
  d.notifications.bookingCustomerConfirmed = {
    title: "أكد العميل الإتمام",
    body: "أكد العميل أن الخدمة اكتملت.",
  };
  d.notifications.bookingIssueReported = {
    title: "أبلغ العميل عن مشكلة",
    body: "أبلغ عميل عن مشكلة في موعد. المحادثة تبقى مفتوحة.",
  };
});

console.log("sprint38 i18n patched");
