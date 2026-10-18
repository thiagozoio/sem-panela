"use client";

import { useActionState } from "react";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { setOrganizer } from "../actions";

export function OrganizerButton({ memberId, isOrganizer, isMe }: { memberId: string; isOrganizer: boolean; isMe: boolean }) {
  const [state, action] = useActionState(setOrganizer, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="value" value={isOrganizer ? "0" : "1"} />
      <SubmitButton variant={isOrganizer ? "danger" : "secondary"} pendingText="…">
        {isOrganizer ? (isMe ? "Deixar de ser organizador" : "Tirar de organizador") : "Tornar organizador"}
      </SubmitButton>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
