"use client";

/**
 * Redimensionne et compresse une image locale en data URL JPEG (≤ 500 Ko)
 * pour l'envoi via Server Action sans stockage objet externe dans le MVP.
 */
export function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image non reconnue."));
      img.onload = () => {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Traitement image indisponible."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        if (dataUrl.length > 700_000) {
          reject(new Error("La photo compressée reste trop volumineuse (500 Ko max)."));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}
