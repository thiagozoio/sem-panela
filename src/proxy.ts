import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, inviteCodeFromPath } from "@/lib/invite";

// Renova a sessão do Supabase a cada requisição. A checagem de acesso de verdade
// fica nas páginas (requireUser) e no banco (RLS).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  await supabase.auth.getClaims();

  // Guarda o convite aberto para levar a pessoa de volta a ele depois do login,
  // mesmo que o "next" se perca (e-mail aberto em outro navegador, app instalado...).
  const invite = inviteCodeFromPath(request.nextUrl.pathname);
  if (invite) {
    response.cookies.set(INVITE_COOKIE, invite, {
      maxAge: INVITE_COOKIE_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
