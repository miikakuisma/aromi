/** Sivu näyttää Aromin koodeista vain vegaanisen ja "paremman valinnan". */
export function DietMarks({ diets }: { diets: string }) {
  const list = (diets || "").split(",").map((s) => s.trim());
  const veg = list.includes("Veg");
  const heart = list.includes("♥");

  if (!veg && !heart) return null;

  return (
    <span className="marks">
      {veg && (
        <b className="mark veg" title="Vegaaninen">
          Veg
        </b>
      )}
      {heart && (
        <b className="mark heart" title="Parempi valinta">
          ♥
        </b>
      )}
    </span>
  );
}
