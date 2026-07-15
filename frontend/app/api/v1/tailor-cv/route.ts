const backendBaseUrl =
  process.env.API_BASE_URL ||
  process.env.INTERNAL_API_BASE_URL ||
  process.env.BACKEND_URL ||
  "http://backend:8080";

export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${backendBaseUrl}/api/v1/tailor-cv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}
