#!/usr/bin/env node
/**
 * Serveur MCP Ofika Delivery en mode STDIO.
 * Compatible Claude Desktop, Cursor, Antigravity, et clients MCP CLI.
 *
 * Utilisation:
 *   npx tsx src/mcp/server.ts
 *
 * Variables d'environnement requises / optionnelles:
 *   OFIKA_API_KEY: Cle API Ofika (ofk_test_... ou ofk_live_...)
 *   DATABASE_URL: Chaine de connexion PostgreSQL Neon (si acces direct DB)
 */

import readline from "readline";
import { dispatchMcpRequest } from "./dispatcher";
import type { JsonRpcRequest } from "./types";

function logError(...args: unknown[]) {
  // Les logs de diagnostic doivent obligatoirement etre envoyes sur stderr
  // afin de ne pas corrompre le canal stdout reserve aux trames JSON-RPC 2.0.
  process.stderr.write(`[ofika-mcp] ${args.map(String).join(" ")}\n`);
}

async function main() {
  logError("Demarrage du serveur MCP Ofika Delivery (transport: stdio)...");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed) as JsonRpcRequest;
      const response = await dispatchMcpRequest(request);

      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err) {
      logError("Erreur de parsing JSON-RPC sur la ligne reçue:", err);
      const parseError = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error: format JSON invalide",
        },
      };
      process.stdout.write(JSON.stringify(parseError) + "\n");
    }
  });

  rl.on("close", () => {
    logError("Fermeture de la session MCP stdio.");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });
}

main().catch((err) => {
  logError("Erreur fatale au lancement du serveur MCP:", err);
  process.exit(1);
});
