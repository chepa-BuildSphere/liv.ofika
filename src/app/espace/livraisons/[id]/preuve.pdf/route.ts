import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth/user-session";
import { DeliveryError, generateProofDossierPdf } from "@/lib/deliveries/deliveries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Non authentifié.", { status: 401 });
  }

  const { id } = await params;

  try {
    const { filename, pdf } = await generateProofDossierPdf(db, user, id);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof DeliveryError) {
      if (e.code === "NOT_FOUND") return new Response(e.message, { status: 404 });
      if (e.code === "FORBIDDEN") return new Response(e.message, { status: 403 });
    }
    throw e;
  }
}
