/** Nome, slogan e endereços do app. Os endereços podem ser trocados pelas variáveis da Vercel. */
export const APP_NAME = "Coletinho";
export const SLOGAN = "A organização é com a gente. O jogo é com você.";
export const SLOGAN_ALT = "Juntou a turma. Começou o jogo.";
export const DESCRIPTION = "Lista de presença, sorteio de times equilibrados e controle de pagamentos da sua pelada.";

/** Endereço oficial do app (NEXT_PUBLIC_SITE_URL na Vercel; em produção, https://coletinho.com.br). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://coletinho.com.br").replace(/\/$/, "");
/** O endereço sem "https://", para mostrar nos textos ("Abra coletinho.com.br no Safari"). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/** Remetente dos e-mails de login (configurado no SMTP do Supabase). */
export const SENDER_EMAIL = process.env.NEXT_PUBLIC_SENDER_EMAIL || "nao-responda@coletinho.com.br";
