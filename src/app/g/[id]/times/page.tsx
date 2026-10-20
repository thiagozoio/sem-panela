import type { Metadata } from "next";
import { Button, Card, Input, Select } from "@/components/ui";
import { MonthNav } from "@/components/month-nav";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { addMonths, monthLabel, monthParam } from "@/lib/format";
import { byPosition, positionInfo, sportOf } from "@/lib/sports";
import type { FixedTeam, Member } from "@/lib/types";
import { addFixedTeam, copyFixedTeams, createFixedTeams, deleteFixedTeam, renameFixedTeam, setPlayerTeam } from "../actions";

export const metadata: Metadata = { title: "Times do mês" };

export default async function FixedTeamsPage({ params, searchParams }: PageProps<"/g/[id]/times">) {
  const { id } = await params;
  const month = monthParam((await searchParams).mes);
  const { supabase, group, members, isOrganizer, readOnly } = await getGroupContext(id);
  const canEdit = isOrganizer && !readOnly;

  const { data } = await supabase
    .from("fixed_teams")
    .select("*")
    .eq("group_id", group.id)
    .in("month", [month, addMonths(month, -1)])
    .order("sort")
    .returns<FixedTeam[]>();
  const teams = (data ?? []).filter((t) => t.month === month);
  const hasPrevious = (data ?? []).some((t) => t.month !== month);

  const byId = new Map(members.map((m) => [m.id, m]));
  const inTeam = new Set(teams.flatMap((t) => t.member_ids));
  const withoutTeam = members.filter((m) => m.active && !inTeam.has(m.id));
  const sport = sportOf(group.sport);
  const order = byPosition(sport);
  const tag = (m: Member) => {
    const info = positionInfo(sport, m.position);
    if (!info) return null;
    return info.value === "goleiro" ? null : <span className="text-xs text-neutral-500"> {info.short}</span>;
  };
  const keeper = (m: Member) => (positionInfo(sport, m.position)?.value === "goleiro" ? "🧤 " : "");

  const hidden = (
    <>
      <input type="hidden" name="group_id" value={group.id} />
      <input type="hidden" name="month" value={month} />
    </>
  );

  const teamPicker = (member: Member, current: string) => (
    <form action={setPlayerTeam} className="flex items-center gap-1">
      {hidden}
      <input type="hidden" name="member_id" value={member.id} />
      <Select name="team_id" defaultValue={current} className="w-32 px-2 py-1.5 text-sm" aria-label={`Time de ${member.name}`}>
        <option value="">Sem time</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Button variant="ghost" className="px-2 py-1.5">
        OK
      </Button>
    </form>
  );

  return (
    <div className="space-y-4">
      <MonthNav month={month} />

      {teams.length === 0 ? (
        <Card className="space-y-3">
          <h3 className="font-semibold">Times fixos de {monthLabel(month)}</h3>
          <p className="text-sm text-neutral-600">
            Monte times que valem o mês inteiro, cada um com seu nome. No dia do jogo, o organizador usa os times fixos em vez do
            sorteio, e quem não tem time (avulsos) completa o time menor.
          </p>
          {canEdit ? (
            <>
              <form action={createFixedTeams} className="space-y-3">
                {hidden}
                <div className="flex items-end gap-2">
                  <label className="text-sm">
                    <span className="block text-neutral-600">Quantos times</span>
                    <Input name="teams" type="number" min={2} max={8} defaultValue={2} className="w-20" />
                  </label>
                  <SubmitButton pendingText="Criando…">Criar times</SubmitButton>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="fill" value="1" defaultChecked className="size-4 accent-pitch-700" />
                  Já distribuir os mensalistas, equilibrando pelo nível
                </label>
              </form>
              {hasPrevious && (
                <form action={copyFixedTeams}>
                  {hidden}
                  <SubmitButton variant="secondary" className="w-full" pendingText="Copiando…">
                    Repetir os times de {monthLabel(addMonths(month, -1))}
                  </SubmitButton>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">O organizador ainda não montou times fixos para este mês.</p>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => {
              const players = t.member_ids.map((mid) => byId.get(mid)).filter((m): m is Member => !!m && m.active);
              return (
                <Card key={t.id} className="space-y-2">
                  {canEdit ? (
                    <form action={renameFixedTeam} className="flex gap-2">
                      <input type="hidden" name="group_id" value={group.id} />
                      <input type="hidden" name="team_id" value={t.id} />
                      <Input name="name" defaultValue={t.name} maxLength={30} required aria-label="Nome do time" className="font-semibold" />
                      <SubmitButton variant="secondary" className="px-3" pendingText="…">
                        Salvar
                      </SubmitButton>
                    </form>
                  ) : (
                    <h3 className="font-semibold text-pitch-900">{t.name}</h3>
                  )}
                  {players.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sem jogadores ainda.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100 text-sm">
                      {players.sort(order).map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span>
                            {keeper(m)}
                            {m.name}
                            {tag(m)}
                          </span>
                          {canEdit && teamPicker(m, t.id)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && (
                    <form action={deleteFixedTeam}>
                      <input type="hidden" name="group_id" value={group.id} />
                      <input type="hidden" name="team_id" value={t.id} />
                      <Button variant="ghost" className="px-2 py-1 text-xs text-red-700">
                        Apagar time
                      </Button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>

          {canEdit && withoutTeam.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Sem time ({withoutTeam.length})</h3>
              <p className="text-xs text-neutral-500">Quem ficar sem time completa o time menor no dia do jogo.</p>
              <ul className="divide-y divide-neutral-100 text-sm">
                {withoutTeam.sort(order).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {keeper(m)}
                      {m.name}
                      {tag(m)}
                      {m.kind === "avulso" && <span className="text-neutral-400"> · avulso</span>}
                    </span>
                    {teamPicker(m, "")}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {canEdit && (
            <form action={addFixedTeam}>
              {hidden}
              <SubmitButton variant="secondary" className="w-full" pendingText="…">
                + Adicionar time
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </div>
  );
}
