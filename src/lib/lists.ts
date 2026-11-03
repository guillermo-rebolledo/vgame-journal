import { randomUUID } from "node:crypto";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { executeBatch } from "@/db/batch";
import { customList, game, listEntry, user } from "@/db/schema";

export type ListVisibility = "private" | "public";
export type ListGame = {
  gameId: number;
  title: string;
  slug: string;
  coverImageId: string | null;
};
export type PublicList = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  creator: { username: string | null; image: string | null };
  games: ListGame[];
  gameCount: number;
};
export type OwnerList = PublicList & {
  visibility: ListVisibility;
  revision: number;
};
export type ListFailure = {
  ok: false;
  code:
    | "validation"
    | "authentication"
    | "not_found"
    | "conflict"
    | "unavailable";
  message: string;
};
export type ListResult<T> = { ok: true; value: T } | ListFailure;
export type CreateListInput = {
  title: string;
  description?: string;
  visibility?: ListVisibility;
  submissionId: string;
};
export type EditListInput = { title: string; description?: string };
export type ListMutation = { revision: number; changed: boolean };
const fail = (code: ListFailure["code"], message: string): ListFailure => ({
  ok: false,
  code,
  message,
});
const authentication = () => fail("authentication", "Sign in to manage lists.");
const unavailable = () =>
  fail("unavailable", "Lists are unavailable. Please try again.");
const validActor = (actor: unknown): actor is string =>
  typeof actor === "string" && actor.length > 0 && actor.length <= 256;
const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const fields = {
  id: customList.id,
  title: customList.title,
  description: customList.description,
  createdAt: customList.createdAt,
  updatedAt: customList.updatedAt,
  creator: { username: user.username, image: user.image },
  games: sql<ListGame[]>`coalesce((select jsonb_agg(jsonb_build_object(
    'gameId', ${game.id}, 'title', ${game.title}, 'slug', ${game.slug}, 'coverImageId', ${game.coverImageId}
  ) order by ${listEntry.position}, ${listEntry.gameId}) from ${listEntry}
  join ${game} on ${game.id} = ${listEntry.gameId} where ${listEntry.listId} = ${customList.id}), '[]'::jsonb)`,
  gameCount: sql<number>`(select count(*)::int from ${listEntry} where ${listEntry.listId} = ${customList.id})`,
};

/** Actor IDs come from a freshly checked session, never submitted owner IDs. Reads are uncached. */
export function createLists(db: Db) {
  async function read<T>(query: PromiseLike<T>): Promise<T> {
    try {
      return await query;
    } catch {
      throw new Error("Lists are unavailable. Please try again.");
    }
  }
  async function mutate(
    actor: unknown,
    id: unknown,
    revision: unknown,
    change: SQL,
    assignments: SQL = sql``,
    valid: SQL = sql`true`,
    deleting = false,
  ): Promise<ListResult<ListMutation>> {
    if (!validActor(actor)) return authentication();
    if (!validId(id)) return fail("not_found", "List not found.");
    if (
      typeof revision !== "number" ||
      !Number.isSafeInteger(revision) ||
      revision < 0 ||
      revision >= 2147483647
    )
      return fail("validation", "Use a valid list revision.");
    try {
      // A fresh READ COMMITTED snapshot after locking sees any writer we waited for.
      const rows = await executeBatch(db, [
        sql`select id from ${customList} where id = ${id} and user_id = ${actor} for update`,
        sql`with current as materialized (select * from ${customList} where id = ${id} and user_id = ${actor}),
          validation as (select (${valid}) as valid),
          eligible as (select * from current where revision = ${revision} and (select valid from validation)),
          changed as (${change}),
          updated as (${
            deleting
              ? sql`select revision + 1 as revision from changed`
              : sql`update ${customList} set ${assignments} revision = revision + 1, updated_at = statement_timestamp()
            where id in (select id from eligible) and exists (select 1 from changed) returning revision`
          })
          select case when not exists (select 1 from current) then 'not_found'
            when (select revision from current) <> ${revision} then 'conflict'
            when not (select valid from validation) then 'validation' else 'ok' end as status,
            coalesce((select revision from updated), (select revision from current)) as revision,
            exists (select 1 from updated) as changed`,
      ]);
      const result = rows[0] as {
        status: "ok" | "not_found" | "conflict" | "validation";
        revision: number;
        changed: boolean;
      };
      if (result.status === "ok")
        return {
          ok: true,
          value: { revision: result.revision, changed: result.changed },
        };
      return fail(
        result.status,
        result.status === "conflict"
          ? "This list changed. Refresh and try again."
          : result.status === "validation"
            ? "Use the list's current games in the new order."
            : "List not found.",
      );
    } catch {
      return unavailable();
    }
  }
  const readOwner = (where: SQL) =>
    read(
      db
        .select({
          ...fields,
          visibility: customList.visibility,
          revision: customList.revision,
        })
        .from(customList)
        .innerJoin(user, eq(user.id, customList.userId))
        .where(where)
        .orderBy(desc(customList.updatedAt), customList.id),
    );
  const readPublic = (where: SQL) =>
    read(
      db
        .select(fields)
        .from(customList)
        .innerJoin(user, eq(user.id, customList.userId))
        .where(and(eq(customList.visibility, "public"), where))
        .orderBy(desc(customList.updatedAt), customList.id),
    );
  return {
    async delete(
      actor: unknown,
      id: unknown,
      revision: unknown,
    ): Promise<ListResult<ListMutation>> {
      return mutate(
        actor,
        id,
        revision,
        sql`delete from ${customList} where id in (select id from eligible) returning revision`,
        sql``,
        sql`true`,
        true,
      );
    },
    async removeGame(
      actor: unknown,
      id: unknown,
      revision: unknown,
      gameId: unknown,
    ): Promise<ListResult<ListMutation>> {
      if (
        typeof gameId !== "number" ||
        !Number.isInteger(gameId) ||
        gameId <= 0 ||
        gameId > 2147483647
      )
        return fail("validation", "Choose a Catalog game.");
      return mutate(
        actor,
        id,
        revision,
        sql`delete from ${listEntry} where list_id in (select id from eligible)
        and game_id = ${gameId} returning game_id`,
      );
    },
    async reorder(
      actor: unknown,
      id: unknown,
      revision: unknown,
      gameIds: unknown,
    ): Promise<ListResult<ListMutation>> {
      if (
        !Array.isArray(gameIds) ||
        gameIds.some(
          (id) =>
            typeof id !== "number" ||
            !Number.isInteger(id) ||
            id <= 0 ||
            id > 2147483647,
        ) ||
        new Set(gameIds).size !== gameIds.length
      )
        return fail("validation", "Use each current game exactly once.");
      const order = sql`ARRAY[${sql.join(
        gameIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::integer[]`;
      return mutate(
        actor,
        id,
        revision,
        sql`update ${listEntry} as entry set position = ordered.ordinality - 1
        from eligible, unnest(${order}) with ordinality as ordered(game_id, ordinality)
        where entry.list_id = eligible.id and entry.game_id = ordered.game_id
          and entry.position <> ordered.ordinality - 1
          and (select coalesce(array_agg(game_id order by position, game_id), '{}'::integer[]) from ${listEntry} where list_id = eligible.id) is distinct from ${order}
        returning entry.game_id`,
        sql``,
        sql`(select count(*) from ${listEntry} where list_id = (select id from current)) = ${gameIds.length}
          and not exists (select 1 from ${listEntry} where list_id = (select id from current) and game_id <> all(${order}))`,
      );
    },
    async addGame(
      actor: unknown,
      id: unknown,
      revision: unknown,
      gameId: unknown,
    ): Promise<ListResult<ListMutation>> {
      if (
        typeof gameId !== "number" ||
        !Number.isInteger(gameId) ||
        gameId <= 0 ||
        gameId > 2147483647
      )
        return fail("validation", "Choose a Catalog game.");
      return mutate(
        actor,
        id,
        revision,
        sql`insert into ${listEntry} (list_id, game_id, position)
        select id, ${gameId}, (select coalesce(max(position), -1) + 1 from ${listEntry} where list_id = eligible.id)
        from eligible on conflict (list_id, game_id) do nothing returning game_id`,
        sql``,
        sql`exists (select 1 from ${game} where id = ${gameId})`,
      );
    },
    async edit(
      actor: unknown,
      id: unknown,
      revision: unknown,
      input: EditListInput,
    ): Promise<ListResult<ListMutation>> {
      if (
        !input ||
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > 100 ||
        (input.description !== undefined &&
          (typeof input.description !== "string" ||
            input.description.length > 2000))
      )
        return fail(
          "validation",
          "Use a title of 1–100 characters and a description up to 2000 characters.",
        );
      const title = input.title.trim();
      const description = input.description ?? "";
      return mutate(
        actor,
        id,
        revision,
        sql`select 1 from eligible where title is distinct from ${title} or description is distinct from ${description}`,
        sql`title = ${title}, description = ${description},`,
      );
    },
    async setVisibility(
      actor: unknown,
      id: unknown,
      revision: unknown,
      visibility: unknown,
    ): Promise<ListResult<ListMutation>> {
      if (visibility !== "private" && visibility !== "public")
        return fail("validation", "Choose Public or Private.");
      return mutate(
        actor,
        id,
        revision,
        sql`select 1 from eligible where visibility <> ${visibility}`,
        sql`visibility = ${visibility},`,
      );
    },
    async ownerCollection(actor: unknown): Promise<OwnerList[]> {
      if (!validActor(actor)) return [];
      return readOwner(eq(customList.userId, actor));
    },
    async ownerDetail(actor: unknown, id: unknown): Promise<OwnerList | null> {
      if (!validActor(actor) || !validId(id)) return null;
      return (
        (
          await readOwner(
            and(eq(customList.userId, actor), eq(customList.id, id)) as SQL,
          )
        )[0] ?? null
      );
    },
    async publicCollection(username: string): Promise<PublicList[]> {
      if (typeof username !== "string") return [];
      return readPublic(eq(user.username, username.toLowerCase()));
    },
    async publicDetail(
      username: string,
      id: unknown,
    ): Promise<PublicList | null> {
      if (typeof username !== "string" || !validId(id)) return null;
      return (
        (
          await readPublic(
            and(
              eq(user.username, username.toLowerCase()),
              eq(customList.id, id),
            ) as SQL,
          )
        )[0] ?? null
      );
    },
    async create(
      actor: unknown,
      input: CreateListInput,
    ): Promise<ListResult<OwnerList>> {
      if (!validActor(actor)) return authentication();
      if (
        !input ||
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > 100 ||
        (input.description !== undefined &&
          (typeof input.description !== "string" ||
            input.description.length > 2000)) ||
        (input.visibility !== undefined &&
          input.visibility !== "private" &&
          input.visibility !== "public") ||
        !validId(input.submissionId)
      )
        return fail(
          "validation",
          "Use a title of 1–100 characters, a description up to 2000 characters, and valid visibility and submission ID.",
        );
      try {
        if (
          !(
            await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.id, actor))
          )[0]
        )
          return authentication();
        const [created] = await db
          .insert(customList)
          .values({
            id: randomUUID(),
            userId: actor,
            submissionId: input.submissionId,
            title: input.title.trim(),
            description: input.description ?? "",
            visibility: input.visibility ?? "private",
          })
          .onConflictDoUpdate({
            target: [customList.userId, customList.submissionId],
            set: { id: sql`${customList.id}` },
          })
          .returning({ id: customList.id });
        const value = await this.ownerDetail(actor, created.id);
        return value ? { ok: true, value } : unavailable();
      } catch {
        return unavailable();
      }
    },
  };
}
export const lists = createLists(db);
