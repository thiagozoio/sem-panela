/**
 * App Android da Google Play (Trusted Web Activity). A regra de pagamentos da Google Play
 * não deixa vender a assinatura do Coletinho dentro do app sem o sistema de cobrança dela,
 * então dentro do app as telas de pagamento da assinatura ficam escondidas.
 *
 * Como sabemos que é o app: ele abre em /grupos?origem=android (android/.../strings.xml), o proxy
 * guarda o cookie abaixo, e o script roda só em tela cheia (display-mode standalone). O Chrome do
 * celular divide os cookies com o app, mas numa aba normal do navegador não é standalone, então
 * lá a assinatura continua aparecendo.
 */
export const ANDROID_APP_COOKIE = "sp_app";
export const ANDROID_APP_PARAM = "origem";
export const ANDROID_APP_VALUE = "android";

/** Põe data-android-app no <html> antes da página aparecer. O CSS usa .play-hide / .play-only. */
export const androidAppScript = `try{if(document.cookie.split("; ").indexOf("${ANDROID_APP_COOKIE}=${ANDROID_APP_VALUE}")>=0&&matchMedia("(display-mode: standalone),(display-mode: fullscreen)").matches)document.documentElement.setAttribute("data-android-app","")}catch(e){}`;
