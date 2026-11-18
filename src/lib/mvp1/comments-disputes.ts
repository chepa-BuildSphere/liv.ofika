import { and, desc, eq } from "drizzle-orm";
import { deliveryComments, deliveries, disputes, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { assertCan, can, type Actor } from "@/lib/auth/permissions";
import { DeliveryError, UUID_RE } from "@/lib/deliveries/errors";
import { tenantScope } from "@/lib/tenant/scope";

export function sanitizeText(raw: string): string {
  return raw
    .trim()
    .replace(/[<>]/g, "") // Enlève les chevrons anti-XSS
    .slice(0, 2000);
}

// ─── Commentaires sur livraisons ─────────────────────────────────────────────

export type AddCommentInput = {
  companyId: string;
  deliveryId: string;
  message: string;
  authorName: string;
};

export async function addDeliveryComment(
  db: Executor,
  actor: Actor,
  input: AddCommentInput,
) {
  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const cleanMessage = sanitizeText(input.message);
  if (!cleanMessage) {
    throw new DeliveryError("INVALID", "Le message ne peut pas être vide.");
  }

  return db.transaction(async (tx) => {
    // Vérifier la livraison
    const [delivery] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        status: deliveries.status,
        courierId: deliveries.courierId,
      })
      .from(deliveries)
      .where(tenantScope(tx, input.companyId).filter(deliveries, eq(deliveries.id, input.deliveryId)))
      .limit(1);

    if (!delivery) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    assertCan(actor, "delivery.comment", {
      companyId: delivery.companyId,
      status: delivery.status,
      courierId: delivery.courierId,
    });

    const [comment] = await tenantScope(tx, input.companyId).insert(deliveryComments, {
      deliveryId: delivery.id,
      authorType: actor.kind === "courier" ? "COURIER" : "USER",
      authorId: actor.id,
      authorName: input.authorName.trim() || (actor.kind === "courier" ? "Livreur" : "Utilisateur"),
      message: cleanMessage,
    });

    await logEvent(tx, {
      companyId: delivery.companyId,
      deliveryId: delivery.id,
      eventType: "DELIVERY_COMMENT_ADDED",
      actorType: actor.kind === "courier" ? "COURIER" : "USER",
      actorId: actor.id,
      fromStatus: delivery.status,
      toStatus: delivery.status,
      payload: {
        commentId: comment.id,
        authorType: comment.authorType,
        authorName: comment.authorName,
      },
    });

    return comment;
  });
}

export async function listDeliveryComments(
  db: Executor,
  companyId: string,
  deliveryId: string,
) {
  if (!UUID_RE.test(deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  return db
    .select()
    .from(deliveryComments)
    .where(
      tenantScope(db, companyId).filter(
        deliveryComments,
        eq(deliveryComments.deliveryId, deliveryId),
      ),
    )
    .orderBy(desc(deliveryComments.createdAt));
}

// ─── Gestion des Litiges (Disputes) ──────────────────────────────────────────

export type DisputeReason =
  | "PACKAGE_NOT_RECEIVED"
  | "PACKAGE_DAMAGED"
  | "PAYMENT_DISCREPANCY"
  | "WRONG_ITEMS"
  | "OTHER";

export type OpenDisputeInput = {
  companyId: string;
  deliveryId: string;
  reason: DisputeReason;
  description: string;
};

export async function openDeliveryDispute(
  db: Executor,
  actor: Actor,
  input: OpenDisputeInput,
) {
  if (!UUID_RE.test(input.deliveryId)) {
    throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
  }

  const cleanDescription = sanitizeText(input.description);
  if (!cleanDescription) {
    throw new DeliveryError("INVALID", "La description du litige est obligatoire.");
  }

  return db.transaction(async (tx) => {
    const [delivery] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        status: deliveries.status,
        courierId: deliveries.courierId,
        reference: deliveries.reference,
      })
      .from(deliveries)
      .where(tenantScope(tx, input.companyId).filter(deliveries, eq(deliveries.id, input.deliveryId)))
      .limit(1);

    if (!delivery) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    assertCan(actor, "dispute.manage", {
      companyId: delivery.companyId,
      status: delivery.status,
      courierId: delivery.courierId,
    });

    const [dispute] = await tenantScope(tx, input.companyId).insert(disputes, {
      deliveryId: delivery.id,
      openedByUserId: actor.kind === "user" ? actor.id : null,
      reason: input.reason,
      status: "OPEN",
      description: cleanDescription,
    });

    await logEvent(tx, {
      companyId: delivery.companyId,
      deliveryId: delivery.id,
      eventType: "DISPUTE_OPENED",
      actorType: actor.kind === "user" ? "USER" : "COURIER",
      actorId: actor.id,
      fromStatus: delivery.status,
      toStatus: delivery.status,
      payload: {
        disputeId: dispute.id,
        reason: input.reason,
        reference: delivery.reference,
      },
    });

    return dispute;
  });
}

export type ResolveDisputeInput = {
  companyId: string;
  disputeId: string;
  resolutionNotes: string;
  status: "RESOLVED" | "REJECTED";
};

export async function resolveDeliveryDispute(
  db: Executor,
  actor: Actor,
  input: ResolveDisputeInput,
) {
  if (!UUID_RE.test(input.disputeId)) {
    throw new DeliveryError("NOT_FOUND", "Litige introuvable.");
  }

  const cleanNotes = sanitizeText(input.resolutionNotes);
  if (!cleanNotes) {
    throw new DeliveryError("INVALID", "Une note de résolution est obligatoire.");
  }

  return db.transaction(async (tx) => {
    const [dispute] = await tx
      .select()
      .from(disputes)
      .where(tenantScope(tx, input.companyId).filter(disputes, eq(disputes.id, input.disputeId)))
      .for("update")
      .limit(1);

    if (!dispute) {
      throw new DeliveryError("NOT_FOUND", "Litige introuvable.");
    }

    const [delivery] = await tx
      .select({
        id: deliveries.id,
        companyId: deliveries.companyId,
        status: deliveries.status,
        courierId: deliveries.courierId,
      })
      .from(deliveries)
      .where(tenantScope(tx, input.companyId).filter(deliveries, eq(deliveries.id, dispute.deliveryId)))
      .limit(1);

    if (!delivery) {
      throw new DeliveryError("NOT_FOUND", "Livraison introuvable.");
    }

    assertCan(actor, "dispute.manage", {
      companyId: delivery.companyId,
      status: delivery.status,
      courierId: delivery.courierId,
    });

    const now = new Date();
    const [updated] = await tenantScope(tx, input.companyId).update(
      disputes,
      {
        status: input.status,
        resolutionNotes: cleanNotes,
        resolvedByUserId: actor.kind === "user" ? actor.id : null,
        resolvedAt: now,
      },
      eq(disputes.id, dispute.id),
    );

    await logEvent(tx, {
      companyId: dispute.companyId,
      deliveryId: dispute.deliveryId,
      eventType: "DISPUTE_RESOLVED",
      actorType: actor.kind === "user" ? "USER" : "COURIER",
      actorId: actor.id,
      fromStatus: delivery.status,
      toStatus: delivery.status,
      payload: {
        disputeId: dispute.id,
        status: input.status,
        resolutionNotes: cleanNotes,
      },
    });

    return updated;
  });
}

export async function listCompanyDisputes(
  db: Executor,
  companyId: string,
  deliveryId?: string,
) {
  const query = db
    .select({
      id: disputes.id,
      deliveryId: disputes.deliveryId,
      deliveryReference: deliveries.reference,
      recipientName: deliveries.recipientName,
      reason: disputes.reason,
      status: disputes.status,
      description: disputes.description,
      resolutionNotes: disputes.resolutionNotes,
      resolvedAt: disputes.resolvedAt,
      resolvedByUserName: users.name,
      createdAt: disputes.createdAt,
    })
    .from(disputes)
    .innerJoin(deliveries, eq(disputes.deliveryId, deliveries.id))
    .leftJoin(users, eq(disputes.resolvedByUserId, users.id))
    .where(
      tenantScope(db, companyId).filter(
        disputes,
        ...(deliveryId ? [eq(disputes.deliveryId, deliveryId)] : []),
      ),
    )
    .orderBy(desc(disputes.createdAt));

  return query;
}
