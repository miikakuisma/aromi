const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Vastaus sisältää kuluvan päivän, joten sitä ei saa säilöä pitkään.
      "Cache-Control": status === 200 ? "public, max-age=120" : "no-store",
      ...CORS_HEADERS,
    },
  });
}
