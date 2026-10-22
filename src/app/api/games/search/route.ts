import type { NextRequest } from "next/server";
import { catalog } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return Response.json(await catalog.search(query.slice(0, 100)));
}
