"use client";

import { useActionState } from "react";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { undoChange } from "../actions";

export function UndoButton({ changeId }: { changeId: string }) {
  const [state, action] = useActionState(undoChange, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Desfazer essa alteração? O que ela mudou volta a ser como era antes.")) e.preventDefault();
      }}
      className="space-y-1"
    >
      <input type="hidden" name="change_id" value={changeId} />
      <SubmitButton variant="secondary" pendingText="Desfazendo…" className="px-3 py-1.5 text-xs">
        ↩ Desfazer
      </SubmitButton>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
