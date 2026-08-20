import { fetchMenuRange } from "@/lib/aromi";
import { todayInHelsinki } from "@/lib/dates";
import { jsonResponse } from "@/lib/http";
import { transformMenu } from "@/lib/transform";

// Reitti lasketaan joka pyynnöllä, koska "tänään" vaihtuu. Aromin haku pysyy
// silti välimuistissa, koska se pyytää sitä itse (cache: "force-cache").
export const revalidate = 0;

export async function GET() {
  try {
    const today = todayInHelsinki();
    const apiData = await fetchMenuRange(today, today);
    return jsonResponse(transformMenu(apiData));
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
}
