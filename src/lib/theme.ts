/** Roda antes da página aparecer, para não piscar branco no modo escuro (ver ThemeToggle). */
export const themeScript = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;
