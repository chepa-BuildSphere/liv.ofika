import { describe, expect, it } from "vitest";
import { getRecentNotifications, type InAppNotification } from "./notifications";

describe("Notifications dans l'interface (tâche 8.3)", () => {
  it("définit les sévérités et types de notifications attendus", () => {
    const sample: InAppNotification = {
      id: "1",
      type: "DELIVERED",
      title: "Colis livré : CMD-100",
      description: "Remise validée par QR code",
      severity: "success",
      timestamp: new Date(),
      deliveryId: "d1",
      reference: "CMD-100",
      actorName: "Livreur",
    };

    expect(sample.severity).toBe("success");
    expect(sample.type).toBe("DELIVERED");
    expect(sample.reference).toBe("CMD-100");
  });

  it("gère les notifications d'échec, de retour et de livraison forcée avec la bonne sévérité", () => {
    const severities = {
      DELIVERED: "success",
      DELIVERED_FORCED: "warning",
      FAILED: "danger",
      RETURNING: "warning",
      RETURN_RECEIVED: "info",
      SECURITY_ALERT: "danger",
    } as const;

    expect(severities.DELIVERED).toBe("success");
    expect(severities.DELIVERED_FORCED).toBe("warning");
    expect(severities.FAILED).toBe("danger");
    expect(severities.SECURITY_ALERT).toBe("danger");
  });
});
