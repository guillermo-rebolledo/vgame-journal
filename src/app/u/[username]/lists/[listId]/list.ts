import { connection } from "next/server";
import { cache } from "react";
import { lists } from "@/lib/lists";

// React cache only deduplicates this request's page and metadata authorization.
export const publicList = cache(async (username: string, id: string) => {
  await connection();
  return lists.publicDetail(username, id);
});
