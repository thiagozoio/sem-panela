export type Position = "linha" | "goleiro";
export type MemberKind = "mensalista" | "avulso";

export type Group = {
  id: string;
  name: string;
  location: string;
  weekday: number;
  start_time: string;
  max_players: number;
  players_per_team: number;
  priority_hours: number;
  monthly_fee_cents: number;
  single_fee_cents: number;
  pix_key: string;
  invite_code: string;
  owner_id: string;
  paid_until: string;
  cash_start_cents: number;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  position: Position;
  /** Vem de member_skills; só o organizador recebe o valor real (padrão 3). */
  skill: number;
  kind: MemberKind;
  is_organizer: boolean;
  active: boolean;
  created_at: string;
};

export type TeamPlayer = { member_id: string; name: string; position: Position };
export type Team = { name: string; players: TeamPlayer[] };

export type Game = {
  id: string;
  group_id: string;
  starts_at: string;
  teams: Team[] | null;
  /** Gols de cada time, na mesma ordem de `teams`. */
  scores: number[] | null;
};

export type GameGoal = { game_id: string; member_id: string; goals: number };
export type RatingSummary = { member_id: string; average: number; votes: number };

export type Attendance = {
  game_id: string;
  member_id: string;
  going: boolean;
  confirmed_at: string;
};

export type Payment = {
  id: string;
  group_id: string;
  member_id: string;
  kind: "mensal" | "avulso";
  month: string | null;
  game_id: string | null;
  amount_cents: number;
  note: string;
  paid_at: string;
};

export type FixedTeam = {
  id: string;
  group_id: string;
  month: string;
  name: string;
  sort: number;
  member_ids: string[];
};

export type Expense = {
  id: string;
  group_id: string;
  month: string;
  description: string;
  amount_cents: number;
  created_at: string;
};
