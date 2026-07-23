import { useTranslations } from "next-intl";
import { AssistantBubble } from "@/components/search/diagnosis-chat-bubble";

export function DiagnosisTypingIndicator() {
  const t = useTranslations("search.diagnosis");

  return (
    <AssistantBubble className="animate-fade-in">
      <span className="sr-only">{t("typingAriaLabel")}</span>
      <span className="flex items-center gap-1 py-0.5" aria-hidden>
        <span className="stagger-1 size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        <span className="stagger-2 size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
        <span className="stagger-3 size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
    </AssistantBubble>
  );
}
