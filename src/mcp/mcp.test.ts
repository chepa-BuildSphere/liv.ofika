import { describe, expect, it } from "vitest";
import { dispatchMcpRequest } from "./dispatcher";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_NAME } from "./types";
import { OFIKA_MCP_TOOLS } from "./tools";
import { OFIKA_MCP_RESOURCES } from "./resources";
import { OFIKA_MCP_PROMPTS } from "./prompts";

describe("Ofika Delivery — Serveur MCP (Model Context Protocol)", () => {
  it("Poignee de main (initialize) : retourne les capacites et la version de protocole 2024-11-05", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(res).not.toBeNull();
    expect(res?.id).toBe(1);
    expect(res?.result).toEqual({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: MCP_SERVER_NAME,
        version: "1.0.0",
      },
    });
  });

  it("Notification d'initialisation : retourne null sans erreur", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res).toBeNull();
  });

  it("Ping : retourne un objet vide de confirmation", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: "test-ping",
      method: "ping",
    });

    expect(res?.id).toBe("test-ping");
    expect(res?.result).toEqual({});
  });

  it("tools/list : expose les 9 outils metier avec schemas d'entree stricts", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(res?.id).toBe(2);
    const tools = (res?.result as { tools: unknown[] }).tools;
    expect(tools.length).toBe(9);

    const names = OFIKA_MCP_TOOLS.map((t) => t.name);
    expect(names).toContain("ofika_create_delivery");
    expect(names).toContain("ofika_get_delivery");
    expect(names).toContain("ofika_list_deliveries");
    expect(names).toContain("ofika_assign_courier");
    expect(names).toContain("ofika_cancel_delivery");
    expect(names).toContain("ofika_list_couriers");
    expect(names).toContain("ofika_simulate_delivery_step");
    expect(names).toContain("ofika_get_audit_trail");
    expect(names).toContain("ofika_get_platform_pricing");
  });

  it("tools/call (ofika_get_platform_pricing) : retourne les informations tarifaires reelles", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "ofika_get_platform_pricing",
        arguments: {},
      },
    });

    expect(res?.id).toBe(3);
    const result = res?.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.platform).toBe("Ofika Delivery");
    expect(parsed.currency).toBe("XOF");
    expect(typeof parsed.price_per_validated_delivery_cfa).toBe("number");
    expect(parsed.monthly_subscription_cfa).toBe(0);
  });

  it("tools/call sans nom d'outil : retourne code d'erreur -32602 (INVALID_PARAMS)", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {},
    });

    expect(res?.error?.code).toBe(-32602);
  });

  it("tools/call sur outil inexistant : signale l'erreur dans la reponse", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "outil_imaginaire",
        arguments: {},
      },
    });

    const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Outil inconnu");
  });

  it("resources/list : expose les 3 ressources de documentation et specification", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "resources/list",
    });

    const resources = (res?.result as { resources: unknown[] }).resources;
    expect(resources.length).toBe(3);

    const uris = OFIKA_MCP_RESOURCES.map((r) => r.uri);
    expect(uris).toContain("ofika://platform/pricing");
    expect(uris).toContain("ofika://openapi/spec");
    expect(uris).toContain("ofika://protocol/overview");
  });

  it("resources/read : retourne le contenu textuel ou JSON d'une ressource", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 7,
      method: "resources/read",
      params: {
        uri: "ofika://protocol/overview",
      },
    });

    const contents = (res?.result as { contents: Array<{ uri: string; text: string }> }).contents;
    expect(contents[0].uri).toBe("ofika://protocol/overview");
    expect(contents[0].text).toContain("Protocole de Preuve Bilaterale");
  });

  it("prompts/list : expose les prompts pre-configures pour agents conversationnels", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 8,
      method: "prompts/list",
    });

    const prompts = (res?.result as { prompts: unknown[] }).prompts;
    expect(prompts.length).toBe(2);

    const names = OFIKA_MCP_PROMPTS.map((p) => p.name);
    expect(names).toContain("ofika_dispatch_delivery");
    expect(names).toContain("ofika_audit_investigator");
  });

  it("prompts/get : instancie le prompt demande avec les variables fournies", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 9,
      method: "prompts/get",
      params: {
        name: "ofika_dispatch_delivery",
        arguments: {
          recipient_name: "Fatou Traore",
          commune: "Cocody",
        },
      },
    });

    const result = res?.result as { messages: Array<{ role: string; content: { text: string } }> };
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content.text).toContain("Fatou Traore");
    expect(result.messages[0].content.text).toContain("Cocody");
  });

  it("Methode JSON-RPC inconnue : retourne erreur -32601 (METHOD_NOT_FOUND)", async () => {
    const res = await dispatchMcpRequest({
      jsonrpc: "2.0",
      id: 10,
      method: "methode_inconnue",
    });

    expect(res?.error?.code).toBe(-32601);
  });
});
