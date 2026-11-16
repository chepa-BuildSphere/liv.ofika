import { eq, inArray } from "drizzle-orm";
import { deliveries } from "@/db/schema";
import { logEvents, type Executor } from "@/lib/audit";
import type { CompanyUserIdentity } from "@/lib/auth/company-user";
import { can, userActor } from "@/lib/auth/permissions";
import { tenantScope } from "@/lib/tenant/scope";
import { DeliveryError, validateDeliveryInput, type DeliveryField, type ValidatedDeliveryInput } from "./deliveries";

export const MAX_IMPORT_ROWS = 500;

export const CSV_TEMPLATE =
  "\uFEFFreference;destinataire;telephone;adresse;quartier;description;montant;commentaire\n" +
  "CMD-1001;Awa Koné;07 07 07 07 07;Rue des Jardins, immeuble Bleu;Cocody;2 paires de chaussures;15000;Appeler en arrivant\n";

export type CsvRow = {
  /** Numéro de ligne d'origine dans le fichier (1-indexé). */
  lineNumber: number;
  cells: string[];
};

export type CsvImportError = {
  lineNumber: number;
  reference: string | null;
  message: string;
};

type ColumnKey =
  | "reference"
  | "recipientName"
  | "recipientPhone"
  | "address"
  | "district"
  | "packageDescription"
  | "amountToCollect"
  | "comment";

const HEADER_ALIASES: Record<ColumnKey, readonly string[]> = {
  reference: ["reference", "ref", "commande", "n_commande", "numero_commande", "num_commande", "order_ref"],
  recipientName: ["destinataire", "nom_destinataire", "nom", "client", "nom_client", "recipient_name", "name"],
  recipientPhone: [
    "telephone",
    "tel",
    "phone",
    "telephone_destinataire",
    "tel_destinataire",
    "numero",
    "mobile",
    "recipient_phone",
  ],
  address: ["adresse", "address", "lieu", "adresse_livraison", "lieu_livraison"],
  district: ["quartier", "commune", "zone", "district"],
  packageDescription: ["description", "colis", "description_colis", "package_description", "article", "contenu"],
  amountToCollect: ["montant", "prix", "montant_a_encaisser", "amount_to_collect", "amount", "cod"],
  comment: ["commentaire", "commentaires", "note", "notes", "instructions", "comment"],
};

const REQUIRED_COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: "reference", label: "reference" },
  { key: "recipientName", label: "destinataire" },
  { key: "recipientPhone", label: "telephone" },
  { key: "address", label: "adresse" },
];

const FIELD_LABELS: Partial<Record<DeliveryField, string>> = {
  reference: "Référence",
  recipientName: "Destinataire",
  recipientPhone: "Téléphone",
  address: "Adresse",
  district: "Quartier",
  packageDescription: "Description",
  amountToCollect: "Montant",
  comment: "Commentaire",
  proofMode: "Mode de preuve",
};

function detectDelimiter(text: string): ";" | "\t" | "," {
  const firstLineEnd = text.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  let inQuotes = false;
  const counts = { ";": 0, "\t": 0, ",": 0 };
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (ch === ";" || ch === "\t" || ch === ",")) {
      counts[ch]++;
    }
  }
  if (counts[";"] >= counts["\t"] && counts[";"] >= counts[","] && counts[";"] > 0) return ";";
  if (counts["\t"] >= counts[","] && counts["\t"] > 0) return "\t";
  if (counts[","] > 0) return ",";
  return ";";
}

/**
 * Parse un CSV ou un copier-coller Excel (`;`, `\t` ou `,`), en conservant
 * le numéro de ligne d'origine (1-indexé) pour le rapport d'erreurs.
 */
export function parseCsvRows(raw: string): { delimiter: ";" | "\t" | ","; rows: CsvRow[] } {
  const clean = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const trimmed = clean.trim();
  if (!trimmed) return { delimiter: ";", rows: [] };

  const delimiter = detectDelimiter(trimmed);
  const rows: CsvRow[] = [];

  let cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let lineNumber = 1;
  let rowStartLine = 1;

  const pushRow = () => {
    cells.push(current);
    const nonEmpty = cells.some((c) => c.trim() !== "");
    if (nonEmpty) {
      rows.push({ lineNumber: rowStartLine, cells });
    }
    cells = [];
    current = "";
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") lineNumber++;
        current += ch;
      }
      continue;
    }

    if (ch === '"' && current.length === 0) {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      cells.push(current);
      current = "";
      continue;
    }

    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      pushRow();
      lineNumber++;
      rowStartLine = lineNumber;
      continue;
    }

    current += ch;
  }

  if (current.length > 0 || cells.length > 0) {
    pushRow();
  }

  return { delimiter, rows };
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function mapHeaderColumns(
  headerCells: string[],
): { ok: true; columns: Partial<Record<ColumnKey, number>> } | { ok: false; missingColumns: string[] } {
  const columns: Partial<Record<ColumnKey, number>> = {};
  const normalized = headerCells.map(normalizeHeader);

  (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
    const aliases = HEADER_ALIASES[key];
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index !== -1) columns[key] = index;
  });

  const missingColumns = REQUIRED_COLUMNS.filter((c) => columns[c.key] === undefined).map((c) => c.label);
  if (missingColumns.length > 0) return { ok: false, missingColumns };
  return { ok: true, columns };
}

function cleanAmountCell(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/(?:\s*(?:f\s*cfa|fcfa|cfa|f))$/i, "")
    .replace(/[\s\u00a0\u202f]+/g, "");
}

export type PreparedCandidate = {
  lineNumber: number;
  data: ValidatedDeliveryInput;
};

export type PrepareCsvResult =
  | { ok: false; code: "EMPTY" | "MISSING_COLUMNS" | "TOO_MANY_ROWS"; message: string; missingColumns?: string[] }
  | { ok: true; totalRows: number; candidates: PreparedCandidate[]; errors: CsvImportError[] };

/** Valide un lot CSV en mémoire (structure, colonnes, champs ligne par ligne, doublons internes). */
export function prepareCsvImport(csvText: string): PrepareCsvResult {
  const { rows } = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { ok: false, code: "EMPTY", message: "Le fichier ou texte CSV est vide." };
  }

  const [headerRow, ...dataRows] = rows;
  const header = mapHeaderColumns(headerRow.cells);
  if (!header.ok) {
    return {
      ok: false,
      code: "MISSING_COLUMNS",
      message: `Colonnes obligatoires manquantes : ${header.missingColumns.join(", ")}.`,
      missingColumns: header.missingColumns,
    };
  }

  if (dataRows.length === 0) {
    return { ok: false, code: "EMPTY", message: "Aucune ligne de livraison trouvée sous l'en-tête." };
  }

  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      code: "TOO_MANY_ROWS",
      message: `Maximum ${MAX_IMPORT_ROWS} lignes par import (${dataRows.length} détectées).`,
    };
  }

  const col = header.columns;
  const cell = (row: CsvRow, key: ColumnKey) => {
    const idx = col[key];
    return idx === undefined ? "" : (row.cells[idx] ?? "");
  };

  const candidates: PreparedCandidate[] = [];
  const errors: CsvImportError[] = [];
  const seenRefs = new Map<string, number>();

  for (const row of dataRows) {
    const rawReference = cell(row, "reference");
    const check = validateDeliveryInput({
      reference: rawReference,
      recipientName: cell(row, "recipientName"),
      recipientPhone: cell(row, "recipientPhone"),
      address: cell(row, "address"),
      district: cell(row, "district"),
      packageDescription: cell(row, "packageDescription"),
      amountToCollect: cleanAmountCell(cell(row, "amountToCollect")),
      comment: cell(row, "comment"),
    });

    if (!check.ok) {
      const details = Object.entries(check.fields)
        .map(([field, msg]) => `${FIELD_LABELS[field as DeliveryField] ?? field} : ${msg}`)
        .join(" ; ");
      errors.push({
        lineNumber: row.lineNumber,
        reference: rawReference.trim() || null,
        message: details,
      });
      continue;
    }

    const firstLine = seenRefs.get(check.data.reference);
    if (firstLine !== undefined) {
      errors.push({
        lineNumber: row.lineNumber,
        reference: check.data.reference,
        message: `Référence « ${check.data.reference} » en doublon dans le fichier (déjà présente ligne ${firstLine}).`,
      });
      continue;
    }

    seenRefs.set(check.data.reference, row.lineNumber);
    candidates.push({ lineNumber: row.lineNumber, data: check.data });
  }

  return { ok: true, totalRows: dataRows.length, candidates, errors };
}

export type CsvImportResult =
  | { ok: false; code: "EMPTY" | "MISSING_COLUMNS" | "TOO_MANY_ROWS"; message: string; missingColumns?: string[] }
  | {
      ok: true;
      totalRows: number;
      importedCount: number;
      imported: (typeof deliveries.$inferSelect)[];
      errors: CsvImportError[];
    };

export async function importDeliveriesFromCsv(
  db: Executor,
  actor: CompanyUserIdentity,
  csvText: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CsvImportResult> {
  if (!can(userActor(actor), "delivery.create", { companyId: actor.companyId }).allowed) {
    throw new DeliveryError("FORBIDDEN", "Réservé à l'admin entreprise et au gestionnaire.");
  }

  const prep = prepareCsvImport(csvText);
  if (!prep.ok) return prep;

  return db.transaction(async (tx) => {
    const errors = [...prep.errors];
    if (prep.candidates.length === 0) {
      return {
        ok: true,
        totalRows: prep.totalRows,
        importedCount: 0,
        imported: [],
        errors: errors.sort((a, b) => a.lineNumber - b.lineNumber),
      };
    }

    const candidateRefs = prep.candidates.map((c) => c.data.reference);
    const existing = await tenantScope(tx, actor.companyId).selectAll(
      deliveries,
      eq(deliveries.isTest, false),
      inArray(deliveries.reference, candidateRefs),
    );
    const existingRefs = new Set(existing.map((e) => e.reference));

    const toInsert: PreparedCandidate[] = [];
    for (const candidate of prep.candidates) {
      if (existingRefs.has(candidate.data.reference)) {
        errors.push({
          lineNumber: candidate.lineNumber,
          reference: candidate.data.reference,
          message: "Cette référence est déjà utilisée par une de vos livraisons.",
        });
      } else {
        toInsert.push(candidate);
      }
    }

    const inserted = await tenantScope(tx, actor.companyId).insertMany(
      deliveries,
      toInsert.map((c) => ({
        ...c.data,
        status: "CREATED" as const,
        isTest: false,
      })),
    );

    if (inserted.length > 0) {
      await logEvents(
        tx,
        inserted.map((row) => ({
          companyId: actor.companyId,
          deliveryId: row.id,
          eventType: "DELIVERY_CREATED",
          actorType: "USER",
          actorId: actor.id,
          fromStatus: null,
          toStatus: "CREATED",
          payload: {
            reference: row.reference,
            recipientName: row.recipientName,
            recipientPhone: row.recipientPhone,
            address: row.address,
            district: row.district,
            amountToCollect: row.amountToCollect,
            proofMode: row.proofMode,
            source: "CSV_IMPORT",
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        })),
      );
    }

    return {
      ok: true,
      totalRows: prep.totalRows,
      importedCount: inserted.length,
      imported: inserted,
      errors: errors.sort((a, b) => a.lineNumber - b.lineNumber),
    };
  });
}
