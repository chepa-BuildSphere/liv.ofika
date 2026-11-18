import { NextResponse } from "next/server";
import { dispatchMcpRequest } from "@/mcp/dispatcher";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_NAME, MCP_SERVER_VERSION, type JsonRpcRequest } from "@/mcp/types";
import { extractBearerToken } from "@/lib/api-keys/api-keys";

/**
 * Endpoint HTTP officiel du serveur MCP Ofika Delivery.
 * Permet aux agents distants d'interagir via le protocole MCP sur HTTP POST.
 */
export async function GET() {
  return NextResponse.json({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    status: "online",
    transports: ["stdio", "http"],
    endpoints: {
      http: "/api/mcp",
      stdio: "npx tsx src/mcp/server.ts",
      documentation: "/api/reference",
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    if (token) {
      // Propage le jeton d'authentification dans l'environnement du process pour cette requete
      process.env.OFIKA_API_KEY = token;
    }

    const body = (await req.json()) as JsonRpcRequest;

    if (!body || typeof body !== "object" || body.jsonrpc !== "2.0") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "Requete JSON-RPC 2.0 invalide. Le champ 'jsonrpc' doit valoir '2.0'.",
          },
        },
        { status: 400 },
      );
    }

    const response = await dispatchMcpRequest(body);

    if (response === null) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-MCP-Protocol": MCP_PROTOCOL_VERSION,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: err instanceof Error ? err.message : "Erreur de traitement JSON-RPC.",
        },
      },
      { status: 400 },
    );
  }
}
