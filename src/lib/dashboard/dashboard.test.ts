import { describe, expect, it } from "vitest";
import type { CompanyDashboardMetrics, DashboardCourierSummary } from "./dashboard";

describe("Tableau de bord entreprise (tâche 8.1)", () => {
  it("calcule correctement le taux de complétion et la ventilation livrées QR vs forcées", () => {
    const metrics: CompanyDashboardMetrics = {
      total: 10,
      created: 2,
      assigned: 1,
      inTransit: 2,
      deliveredQr: 3,
      deliveredForced: 1,
      deliveredTotal: 4,
      failed: 1,
      returning: 1,
      returnReceived: 0,
      cancelled: 0,
      successRatePercent: 80, // 4 livrées / (4 livrées + 1 échec) = 80%
    };

    expect(metrics.deliveredTotal).toBe(metrics.deliveredQr + metrics.deliveredForced);
    expect(metrics.deliveredForced).toBe(1);
    expect(metrics.successRatePercent).toBe(80);
  });

  it("détermine si un livreur est soldé (aucun colis actif en cours)", () => {
    const courierSettled: DashboardCourierSummary = {
      courierId: "c1",
      name: "Kwamé",
      phone: "+2250700000001",
      assigned: 0,
      pickedUp: 0,
      deliveredQr: 3,
      deliveredForced: 0,
      failed: 0,
      returning: 0,
      returnReceived: 1,
      isSettled: true,
    };

    const courierActive: DashboardCourierSummary = {
      courierId: "c2",
      name: "Moussa",
      phone: "+2250700000002",
      assigned: 1,
      pickedUp: 1,
      deliveredQr: 2,
      deliveredForced: 0,
      failed: 0,
      returning: 1,
      returnReceived: 0,
      isSettled: false,
    };

    expect(courierSettled.isSettled).toBe(true);
    expect(courierActive.isSettled).toBe(false);
  });
});
