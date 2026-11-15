// Signature de marque : « Ofika » en noir, « Delivery » en orange.
// En attendant un logo : un seul endroit à changer quand il existera.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-ink ${className}`}>
      Ofika <span className="text-brand">Delivery</span>
    </span>
  );
}
