import Link from "next/link";
import type { CoachAction } from "./types";

type Props = { action: CoachAction };

export default function ActionCard({ action }: Props) {
  const getHref = (): string | null => {
    switch (action.type) {
      case "plan_created":
      case "plan_updated":
        return `/sessions/${action.sessionId}`;
      case "review_created":
        return `/sessions/${action.sessionId}`;
      case "question_answered":
        return `/sessions/${action.sessionId}`;
      case "proposal_created":
        return `/program`;
      case "research_saved":
        return `/program#research`;
      case "preference_saved":
        return `/settings`;
      case "consideration_saved":
        return `/settings`;
      case "schedule_updated":
        return `/settings`;
      case "checkin_saved":
        return null;
      default:
        return null;
    }
  };

  const getLabel = (): string => {
    switch (action.type) {
      case "plan_created":
        return "Plan ready — open workout";
      case "plan_updated":
        return "Plan updated — open workout";
      case "review_created":
        return "Session review — open";
      case "question_answered":
        return "Answer noted";
      case "proposal_created":
        return "Program proposal — review it";
      case "research_saved":
        return "Research note saved";
      case "preference_saved":
        return `Saved preference: ${action.exerciseName} (${action.kind})`;
      case "consideration_saved":
        return "Saved to your considerations";
      case "schedule_updated":
        return "Schedule updated";
      case "checkin_saved":
        return "Check-in saved";
      default:
        return "";
    }
  };

  const href = getHref();
  const label = getLabel();

  const cardClasses = "min-h-[44px] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs p-3 rounded transition-colors flex items-center break-words";

  if (href) {
    return (
      <Link href={href} className={`${cardClasses} hover:border-[var(--color-accent)]`}>
        {label}
      </Link>
    );
  }

  return <div className={cardClasses}>{label}</div>;
}
