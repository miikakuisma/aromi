import { savedAtLabel } from "@/lib/store";

export function Skeleton() {
  return (
    <div className="state skeleton" aria-label="Ladataan ruokalistaa">
      <span style={{ width: "40%" }} />
      <span style={{ width: "85%" }} />
      <span style={{ width: "60%" }} />
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state">
      <p>Ruokalistaa ei juuri nyt saatu haettua.</p>
      <button className="retry" onClick={onRetry}>
        Yritä uudelleen
      </button>
    </div>
  );
}

/** Näkyy vain kun haku epäonnistui ja ruudulla on tallennettu lista. */
export function StaleBanner({ savedAt }: { savedAt: number | null }) {
  if (savedAt === null) return null;
  return (
    <p className="stale" role="status">
      Ei yhteyttä — lista tallennettu {savedAtLabel(savedAt)}.
    </p>
  );
}
