import { useTranslations } from "next-intl";
import { AssistantBubble, UserBubble } from "@/components/search/diagnosis-chat-bubble";
import type { DiagnosisQuestion } from "@/lib/diagnosis/types";
import type { ProblemId } from "@/lib/search/engine/types";

type Props = {
  problemId: ProblemId;
  question: DiagnosisQuestion;
  optionId: string;
};

export function DiagnosisHistoryEntry({ problemId, question, optionId }: Props) {
  const t = useTranslations("search.diagnosis");
  const base = `problems.${problemId}.questions.${question.id}` as const;

  return (
    <div className="space-y-1.5">
      <AssistantBubble>
        {t(`${base}.label` as "problems.power_outage.questions.state.label")}
      </AssistantBubble>
      <UserBubble>
        {t(
          `${base}.options.${optionId}` as "problems.power_outage.questions.state.options.off",
        )}
      </UserBubble>
    </div>
  );
}
