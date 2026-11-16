/** Vérifie qu'une URL média provient d'un schéma sûr (`data:image/(jpeg|png|webp)` ou `http(s)://`). */
export function isSafeMediaUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
