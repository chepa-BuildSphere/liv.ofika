import {
  JSON_RPC_ERRORS,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./types";
import { OFIKA_MCP_TOOLS, executeMcpTool } from "./tools";
import { OFIKA_MCP_RESOURCES, readMcpResource } from "./resources";
import { OFIKA_MCP_PROMPTS, getMcpPromptMessages } from "./prompts";

/**
 * Traite une requete JSON-RPC 2.0 MCP entrante et retourne la reponse correspondante.
 * Conforme au standard Model Context Protocol.
 */
export async function dispatchMcpRequest(
  request: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const { id = null, method, params = {} } = request;

  // Traitement des notifications (sans ID)
  if (id === undefined && method.startsWith("notifications/")) {
    return null;
  }

  try {
    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: MCP_SERVER_NAME,
              version: MCP_SERVER_VERSION,
            },
          },
        };
      }

      case "notifications/initialized": {
        return null;
      }

      case "ping": {
        return {
          jsonrpc: "2.0",
          id,
          result: {},
        };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: OFIKA_MCP_TOOLS,
          },
        };
      }

      case "tools/call": {
        const toolName = typeof params.name === "string" ? params.name : "";
        const args = (params.arguments as Record<string, unknown>) || {};

        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: JSON_RPC_ERRORS.INVALID_PARAMS,
              message: "Le parametre 'name' est requis pour 'tools/call'.",
            },
          };
        }

        const callResult = await executeMcpTool(toolName, args);
        return {
          jsonrpc: "2.0",
          id,
          result: callResult,
        };
      }

      case "resources/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: OFIKA_MCP_RESOURCES,
          },
        };
      }

      case "resources/read": {
        const uri = typeof params.uri === "string" ? params.uri : "";
        if (!uri) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: JSON_RPC_ERRORS.INVALID_PARAMS,
              message: "Le parametre 'uri' est requis pour 'resources/read'.",
            },
          };
        }

        try {
          const content = await readMcpResource(uri);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [content],
            },
          };
        } catch (e) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: JSON_RPC_ERRORS.INVALID_PARAMS,
              message: e instanceof Error ? e.message : String(e),
            },
          };
        }
      }

      case "prompts/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: OFIKA_MCP_PROMPTS,
          },
        };
      }

      case "prompts/get": {
        const promptName = typeof params.name === "string" ? params.name : "";
        const promptArgs = (params.arguments as Record<string, string>) || {};

        if (!promptName) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: JSON_RPC_ERRORS.INVALID_PARAMS,
              message: "Le parametre 'name' est requis pour 'prompts/get'.",
            },
          };
        }

        try {
          const messages = getMcpPromptMessages(promptName, promptArgs);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              description: OFIKA_MCP_PROMPTS.find((p) => p.name === promptName)?.description,
              messages,
            },
          };
        } catch (e) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: JSON_RPC_ERRORS.INVALID_PARAMS,
              message: e instanceof Error ? e.message : String(e),
            },
          };
        }
      }

      default: {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Methode non supportee: ${method}`,
          },
        };
      }
    }
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: JSON_RPC_ERRORS.INTERNAL_ERROR,
        message: err instanceof Error ? err.message : "Erreur interne du serveur MCP.",
      },
    };
  }
}
