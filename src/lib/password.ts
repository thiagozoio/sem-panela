export const MIN_PASSWORD = 8;

/** Confere a senha nova antes de mandar ao Supabase. Devolve a mensagem de erro ou null. */
export function checkNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  if (password !== confirm) return "As duas senhas não são iguais.";
  return null;
}
