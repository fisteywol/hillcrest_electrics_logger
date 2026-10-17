import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiUrl = process.env.LOGS_API_URL;
  const apiKey = process.env.LOGS_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server is not configured. Add LOGS_API_URL and LOGS_API_KEY in Vercel Environment Variables." },
      { status: 500 }
    );
  }

  const afterId = request.nextUrl.searchParams.get("after_id") ?? "0";
  const limit = request.nextUrl.searchParams.get("limit") ?? "100";
  const target = new URL(apiUrl);
  target.searchParams.set("after_id", afterId);
  target.searchParams.set("limit", limit);

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: { "X-API-Key": apiKey, "Accept": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Logs API request failed:", error);
    return NextResponse.json({ error: "Could not reach the logs API. Check LOGS_API_URL and the API server." }, { status: 502 });
  }
}
