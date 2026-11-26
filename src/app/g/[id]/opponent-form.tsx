import { Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { setOpponent } from "./actions";

/** Organizador escreve contra quem é o jogo (formato contra time de fora), com os adversários já conhecidos de sugestão. */
export function OpponentForm({
  groupId,
  gameId,
  opponent,
  suggestions,
}: {
  groupId: string;
  gameId: string;
  opponent: string;
  suggestions: string[];
}) {
  const listId = `adversarios-${gameId}`;
  return (
    <form action={setOpponent} className="space-y-2" key={opponent}>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="game_id" value={gameId} />
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Adversário deste jogo</span>
        <Input name="opponent" defaultValue={opponent} maxLength={60} list={listId} placeholder="Nome do time de fora" />
      </label>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <SubmitButton variant="secondary" className="w-full">
        {opponent ? "Trocar adversário" : "Salvar adversário"}
      </SubmitButton>
    </form>
  );
}
