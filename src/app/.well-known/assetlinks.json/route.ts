// Digital Asset Links: prova para o Android que o app "Sem Panela" da Google Play
// é deste site. Sem isso o app abre com uma barra de endereço em cima.
// Docs: https://developer.android.com/training/app-links/verify-android-applinks

const PACKAGE_NAME = "br.app.sempanela";

// Impressão digital (SHA-256) da chave de upload, que assina o .aab gerado no GitHub.
const UPLOAD_KEY_SHA256 =
  "1B:1D:36:3F:44:02:93:A8:59:99:93:7E:0C:D3:FF:3A:46:09:49:1B:E1:DA:FB:4E:2E:86:BD:F4:73:5A:6A:BE";

// A Google Play assina de novo o app com a chave dela ("Assinatura de apps do Google Play").
// Essa impressão digital aparece no Play Console em Configuração > Integridade do app e vai
// na variável ANDROID_SHA256_FINGERPRINTS da Vercel (pode ter mais de uma, separadas por vírgula).
function fingerprints(): string[] {
  const extra = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  return Array.from(new Set([UPLOAD_KEY_SHA256, ...extra]));
}

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints() },
    },
  ];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
