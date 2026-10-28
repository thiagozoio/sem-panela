import type { Metadata } from "next";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { positionInfo, positionOf, positionOptions, sportOf, type Sport } from "@/lib/sports";
import { formatPhone, whatsappTo } from "@/lib/matches";
import type { Member } from "@/lib/types";
import { addMember, setMemberActive, updateMember } from "../actions";
import { AccessLinkButton } from "./access-link-button";
import { OrganizerButton } from "./organizer-button";

export const metadata: Metadata = { title: "Jogadores" };

const SKILLS = [
  [1, "1 · Iniciante"],
  [2, "2 · Fraco"],
  [3, "3 · Médio"],
  [4, "4 · Bom"],
  [5, "5 · Craque"],
] as const;

function MemberFields({ member, sport }: { member?: Member; sport: Sport }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Nome">
          <Input name="name" defaultValue={member?.name} maxLength={60} required />
        </Field>
      </div>
      <Field label="Posição">
        <Select name="position" defaultValue={positionOf(sport, member?.position ?? "linha")}>
          {positionOptions(sport).map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
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
        <Field label="Telefone (WhatsApp)" hint="Opcional. Só os organizadores veem.">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={member?.phone} placeholder="(47) 99999-9999" maxLength={30} />
        </Field>
      </div>
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
  const { group, members, me, isOrganizer, readOnly } = await getGroupContext(id);
  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);
  const canEdit = isOrganizer && !readOnly;
  const sport = sportOf(group.sport);

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
                    <PlayerSummary member={m} sport={sport} showSkill />
                    <span className="text-xs text-pitch-700">editar</span>
                  </summary>
                  {m.phone && <PhoneLink phone={m.phone} className="mt-2" />}
                  <form action={updateMember} className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-3">
                    <input type="hidden" name="group_id" value={group.id} />
                    <input type="hidden" name="member_id" value={m.id} />
                    <MemberFields member={m} sport={sport} />
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton>Salvar</SubmitButton>
                      {!m.is_organizer && (
                        <Button variant="danger" formAction={setMemberActive} name="active" value="0">
                          Tirar do grupo
                        </Button>
                      )}
                    </div>
                  </form>
                  {!m.is_organizer && (
                    <div className="mt-2 rounded-xl bg-neutral-50 p-3">
                      <AccessLinkButton memberId={m.id} memberName={m.name} groupName={group.name} phone={m.phone} />
                    </div>
                  )}
                  <div className="mt-2 rounded-xl bg-neutral-50 p-3">
                    {m.user_id ? (
                      <OrganizerButton memberId={m.id} isOrganizer={m.is_organizer} isMe={m.id === me?.id} />
                    ) : (
                      <p className="text-xs text-neutral-500">Para virar organizador, a pessoa precisa entrar primeiro (pelo convite ou pelo acesso acima).</p>
                    )}
                  </div>
                </details>
              ) : (
                <PlayerSummary member={m} sport={sport} showSkill={false} />
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <p className="text-xs text-neutral-500">
            Organizadores podem mexer na lista, nos times e no financeiro. Pode ter mais de um. Para passar a pelada para outra
            pessoa, torne ela organizadora e depois deixe de ser.
          </p>
        )}
      </Card>

      {canEdit && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">+ Cadastrar jogador</summary>
            <p className="mt-2 text-sm text-neutral-600">
              Para quem ainda não entrou pelo link. Depois é só abrir o jogador e tocar em “Enviar acesso pelo WhatsApp”: ele entra sem e-mail. Quem preferir pode entrar pelo convite e escolher o próprio nome.
            </p>
            <form action={addMember} className="mt-3 space-y-3">
              <input type="hidden" name="group_id" value={group.id} />
              <MemberFields sport={sport} />
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

function PlayerSummary({ member, sport, showSkill }: { member: Member; sport: Sport; showSkill: boolean }) {
  const position = positionInfo(sport, member.position);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{member.name}</span>
      {position && <Badge tone={position.value === "goleiro" ? "amber" : "neutral"}>{position.label.toLowerCase()}</Badge>}
      <Badge tone={member.kind === "mensalista" ? "green" : "neutral"}>{member.kind}</Badge>
      {member.is_organizer && <Badge>organizador</Badge>}
      {!member.user_id && <Badge>sem conta</Badge>}
      {showSkill && <span className="text-amber-600">{"★".repeat(member.skill)}</span>}
    </div>
  );
}

function PhoneLink({ phone, className = "" }: { phone: string; className?: string }) {
  const href = whatsappTo(phone);
  const label = `📞 ${formatPhone(phone)}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`block text-sm font-medium text-pitch-700 ${className}`}>
      {label} · WhatsApp
    </a>
  ) : (
    <p className={`text-sm text-neutral-600 ${className}`}>{label}</p>
  );
}
