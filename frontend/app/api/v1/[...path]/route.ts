const backendBaseUrl =
  process.env.API_BASE_URL ||
  process.env.INTERNAL_API_BASE_URL ||
  process.env.BACKEND_URL ||
  "http://backend-api:8080";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function forwardRequest(request: Request, { params }: RouteContext) {
  const { path } = params;
  const upstreamUrl = new URL(`/api/v1/${path.join("/")}`, backendBaseUrl);
  upstreamUrl.search = new URL(request.url).search;

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json"
    },
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store"
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json; charset=utf-8"
    }
  });
}

export async function GET(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forwardRequest(request, context);
}
