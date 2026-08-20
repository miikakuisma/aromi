import { fetchMenuRange } from "@/lib/aromi";
import { addDays, mondayOf, todayInHelsinki } from "@/lib/dates";
import { jsonResponse } from "@/lib/http";
import { transformWeek } from "@/lib/transform";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const offset =
      Number(new URL(request.url).searchParams.get("offset")) || 0;
    const today = todayInHelsinki();
    const monday = addDays(mondayOf(today), offset * 7);
    const apiData = await fetchMenuRange(monday, addDays(monday, 4));
    return jsonResponse(transformWeek(apiData, monday, today));
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
}
