import type { Metadata } from "next";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import type { Member } from "@/lib/types";
import { addMember, setMemberActive, updateMember } from "../actions";

export const metadata: Metadata = { title: "Jogadores" };

const SKILLS = [
  [1, "1 · Iniciante"],
  [2, "2 · Fraco"],
  [3, "3 · Médio"],
  [4, "4 · Bom"],
  [5, "5 · Craque"],
] as const;

function MemberFields({ member }: { member?: Member }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Nome">
          <Input name="name" defaultValue={member?.name} maxLength={60} required />
        </Field>
      </div>
      <Field label="Posição">
        <Select name="position" defaultValue={member?.position ?? "linha"}>
          <option value="linha">Linha</option>
          <option value="goleiro">Goleiro</option>
        </Select>
      </Field>
      <Field label="Nível">
        <Select name="skill" defaultValue={member?.skill ?? 3}>
          {SKILLS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <div className="col-span-2">
        <Field label="Tipo">
          <Select name="kind" defaultValue={member?.kind ?? "avulso"}>
            <option value="mensalista">Mensalista</option>
            <option value="avulso">Avulso (paga por jogo)</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}

export default async function PlayersPage({ params }: PageProps<"/g/[id]/jogadores">) {
  const { id } = await params;
  const { group, members, isOrganizer, readOnly } = await getGroupContext(id);
  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);
  const canEdit = isOrganizer && !readOnly;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Jogadores ({active.length})</h2>
          {isOrganizer && <span className="text-xs text-neutral-500">O nível dos jogadores só você vê.</span>}
        </div>
        <ul className="divide-y divide-neutral-100">
          {active.map((m) => (
            <li key={m.id} className="py-2">
              {canEdit ? (
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <PlayerSummary member={m} showSkill />
                    <span className="text-xs text-pitch-700">editar</span>
                  </summary>
                  <form action={updateMember} className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-3">
                    <input type="hidden" name="group_id" value={group.id} />
                    <input type="hidden" name="member_id" value={m.id} />
                    <MemberFields member={m} />
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton>Salvar</SubmitButton>
                      {!m.is_organizer && (
                        <Button variant="danger" formAction={setMemberActive} name="active" value="0">
                          Tirar do grupo
                        </Button>
                      )}
                    </div>
                  </form>
                </details>
              ) : (
                <PlayerSummary member={m} showSkill={false} />
              )}
            </li>
          ))}
        </ul>
      </Card>

      {canEdit && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">+ Cadastrar jogador</summary>
            <p className="mt-2 text-sm text-neutral-600">
              Para quem ainda não entrou pelo link. Quando a pessoa entrar pelo convite, ela escolhe o próprio nome e assume o cadastro.
            </p>
            <form action={addMember} className="mt-3 space-y-3">
              <input type="hidden" name="group_id" value={group.id} />
              <MemberFields />
              <SubmitButton className="w-full">Cadastrar</SubmitButton>
            </form>
          </details>
        </Card>
      )}

      {canEdit && inactive.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold text-neutral-600">Fora do grupo</h2>
          <ul className="divide-y divide-neutral-100">
            {inactive.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span>{m.name}</span>
                <form action={setMemberActive}>
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="member_id" value={m.id} />
                  <Button variant="ghost" name="active" value="1" className="px-3 py-1.5">
                    Voltar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PlayerSummary({ member, showSkill }: { member: Member; showSkill: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{member.name}</span>
      {member.position === "goleiro" && <Badge tone="amber">goleiro</Badge>}
      <Badge tone={member.kind === "mensalista" ? "green" : "neutral"}>{member.kind}</Badge>
      {member.is_organizer && <Badge>organizador</Badge>}
      {!member.user_id && <Badge>sem conta</Badge>}
      {showSkill && <span className="text-amber-600">{"★".repeat(member.skill)}</span>}
    </div>
  );
}
