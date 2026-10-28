import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isLinkToken, linkEmail } from "@/lib/player-link";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

type LinkInfo = { member_id: string; user_id: string | null; member_name: string; group_id: string; group_name: string };

async function lookup(token: string, consume: boolean): Promise<LinkInfo | null> {
  const admin = createAdminClient();
  if (!admin || !isLinkToken(token)) return null;
  const { data } = await admin
    .rpc("redeem_member_link", { p_token: token, p_consume: consume })
    .maybeSingle<LinkInfo>();
  return data ?? null;
}

/** Conta do jogador: a que já está ligada ao cadastro ou uma nova, criada agora. */
async function accountFor(info: LinkInfo, token: string): Promise<string | null> {
  if (info.user_id) return info.user_id;
  const admin = createAdminClient()!;
  const { data: created } = await admin.auth.admin.createUser({
    email: linkEmail(info.member_id),
    email_confirm: true,
    app_metadata: { via_link: true },
    user_metadata: { name: info.member_name },
  });
  if (!created.user) {
    // Dois toques ao mesmo tempo: a outra requisição já criou e ligou a conta.
    return (await lookup(token, false))?.user_id ?? null;
  }
  const { data: linked } = await admin.rpc("link_member_account", {
    p_member_id: info.member_id,
    p_user_id: created.user.id,
  });
  return (linked as string | null) ?? null;
}

async function enter(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const info = await lookup(token, true);
  if (!info) redirect(`/entrar/${token}`);

  const userId = await accountFor(info, token);
  const admin = createAdminClient()!;
  const { data: account } = userId ? await admin.auth.admin.getUserById(userId) : { data: { user: null } };
  const email = account.user?.email;
  const { data: link } = email ? await admin.auth.admin.generateLink({ type: "magiclink", email }) : { data: null };
  const tokenHash = link?.properties?.hashed_token;
  if (!tokenHash) redirect(`/entrar/${token}?erro=1`);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) redirect(`/entrar/${token}?erro=1`);
  redirect(`/g/${info.group_id}`);
}

export default async function EnterPage({ params, searchParams }: PageProps<"/entrar/[token]">) {
  const { token } = await params;
  const { erro } = await searchParams;
  // Só confere o link aqui; ele é usado no toque do botão. Assim a prévia que o
  // WhatsApp gera ao receber a mensagem não gasta o link.
  const info = await lookup(token, false);
  if (info?.user_id) {
    const session = await getSessionUser();
    if (session?.id === info.user_id) redirect(`/g/${info.group_id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-4xl">⚽</p>
        <h1 className="mt-2 text-2xl font-extrabold text-pitch-900">Sem Panela</h1>
      </div>
      <Card>
        {info ? (
          <form action={enter} className="space-y-4 text-center">
            <input type="hidden" name="token" value={token} />
            <p>
              Oi, <strong>{info.member_name}</strong>! Toque no botão para entrar na pelada{" "}
              <strong>{info.group_name}</strong>.
            </p>
            {erro && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Não deu para entrar. Tente de novo.</p>
            )}
            <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
            <p className="text-xs text-neutral-500">Você fica conectado neste celular. Não precisa de senha.</p>
          </form>
        ) : (
          <div className="space-y-2 text-center">
            <p className="font-medium">Esse link expirou ou já foi usado.</p>
            <p className="text-sm text-neutral-600">Peça um link novo para o organizador da sua pelada.</p>
          </div>
        )}
      </Card>
    </main>
  );
}
