import { OFIKA_OPENAPI_SPEC } from "@/lib/api-keys/openapi-spec";

// Version exacte fixée de @scalar/api-reference (conformément à la politique SRI / CDN).
// Note: pensez à mettre à jour périodiquement cette version patch si nécessaire.
const SCALAR_STANDALONE_URL =
  "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.122/dist/browser/standalone.min.js";

export function GET() {
  const safeSpecJson = JSON.stringify(OFIKA_OPENAPI_SPEC).replace(/</g, "\\u003c");

  const configuration = {
    theme: "kepler",
    layout: "modern",
    darkMode: false,
    hideDownloadButton: false,
    showSidebar: true,
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },
    authentication: {
      preferredSecurityScheme: "BearerAuth",
      http: {
        bearer: {
          token: "ofk_test_votre_cle_secrete",
        },
      },
    },
    metaData: {
      title: "Documentation API Scalar — Ofika Delivery (v1)",
    },
  };

  const safeConfigJson = JSON.stringify(configuration).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Documentation API Scalar — Ofika Delivery (v1)</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
      .light-mode, :root {
        --scalar-color-accent: #C2410C;
        --scalar-button-1: #C2410C;
        --scalar-button-1-hover: #9A3412;
        --scalar-button-1-color: #FFFFFF;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      type="application/json"
      data-configuration='${safeConfigJson.replace(/'/g, "&#39;")}'
    >${safeSpecJson}</script>
    <script src="${SCALAR_STANDALONE_URL}" crossorigin="anonymous"></script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
