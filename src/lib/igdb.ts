import { linkMonitoringError } from "@/lib/error-monitoring";
import {
  compareTagGames,
  type DatePrecision,
  GAME_TYPES,
  type GameSource,
  type RecommendationGame,
  type SourceAgeRating,
  type SourceGame,
  type SourceLanguage,
  type SourceReleaseDate,
  STANDALONE_TYPES,
  type SteamMapping,
} from "@/lib/game-source";
import { GAME_TAGS } from "@/lib/game-tags";
import { IGDB_TAGS } from "@/lib/igdb-tags";
import {
  OperationalError,
  operationalCode,
  reportOperationalError,
} from "@/lib/operational-errors";
import { retryAfterUntil } from "@/lib/retry-after";

// Server-only: the Twitch secret never reaches the browser, and no client calls IGDB.

/** Runs tasks with at most `perSecond` starts in any second and `concurrent` open at once. */
export function createLimiter(perSecond: number, concurrent: number) {
  const starts: number[] = [];
  const queue: (() => void)[] = [];
  let open = 0;
  let waiting = false;

  function pump() {
    while (queue.length && open < concurrent) {
      const now = Date.now();
      while (starts.length && now - starts[0] >= 1000) starts.shift();
      if (starts.length >= perSecond) {
        if (!waiting) {
          waiting = true;
          setTimeout(
            () => {
              waiting = false;
              pump();
            },
            1000 - (now - starts[0]),
          );
        }
        return;
      }
      starts.push(now);
      open++;
      queue.shift()?.();
    }
  }

  return <T>(task: () => Promise<T>, signal?: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const abort = () => {
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        reject(signal?.reason);
      };
      const start = () => {
        signal?.removeEventListener("abort", abort);
        task()
          .then(resolve, reject)
          .finally(() => {
            open--;
            pump();
          });
      };
      signal?.addEventListener("abort", abort, { once: true });
      queue.push(start);
      pump();
    });
}

// ponytail: per server instance; IGDB's 4 req/s is app-wide, so several warm instances can exceed it. Move to a shared store (e.g. Upstash) if 429s show up.
const limit = createLimiter(4, 8);

let retryAt = 0;

let token: { value: string; expiresAt: number } | undefined;

const requestSignal = (signal?: AbortSignal) =>
  signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
    : AbortSignal.timeout(10000);

async function accessToken(signal?: AbortSignal) {
  if (token && token.expiresAt > Date.now()) return token.value;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    signal: requestSignal(signal),
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID ?? "",
      client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
    }),
  });
  checkResponse(res);
  const { access_token, expires_in } = (await res.json()) ?? {};
  if (
    typeof access_token !== "string" ||
    !access_token ||
    !Number.isFinite(expires_in)
  )
    throw new OperationalError("invalid_response");
  token = {
    value: access_token,
    expiresAt: Date.now() + (expires_in - 60) * 1000,
  };
  return token.value;
}

function checkResponse(response: Response) {
  if (response.status === 429) {
    retryAt = Math.max(
      retryAt,
      retryAfterUntil(response.headers.get("retry-after")),
    );
    throw new OperationalError("rate_limited");
  }
  if (!response.ok) throw new OperationalError("unavailable");
}

/** POSTs an Apicalypse query to an IGDB endpoint. */
async function igdb<T>(
  endpoint: string,
  body: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const deadline = requestSignal(signal);
  try {
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      // Recheck after waking: a timer can fire just before Date.now() reaches retryAt.
      while (attempt < 3) {
        const delay = retryAt - Date.now();
        if (delay <= 0 || delay > 3000) break;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(deadline.reason);
          };
          const timer = setTimeout(() => {
            deadline.removeEventListener("abort", abort);
            resolve();
          }, delay);
          deadline.addEventListener("abort", abort, { once: true });
        });
      }
      res = await limit(async () => {
        deadline.throwIfAborted();
        if (Date.now() < retryAt) throw new OperationalError("rate_limited");
        const access = await accessToken(deadline);
        deadline.throwIfAborted();
        return fetch(`https://api.igdb.com/v4/${endpoint}`, {
          method: "POST",
          signal: deadline,
          headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
            Authorization: `Bearer ${access}`,
          },
          body,
        });
      }, deadline);
      if (res.status !== 429 || attempt >= 2) break;
      retryAt = Math.max(
        retryAt,
        retryAfterUntil(res.headers.get("retry-after")),
        Date.now() + 250 * 2 ** attempt,
      );
    }
    if (res.status === 401) token = undefined;
    checkResponse(res);
    const result = await res.json();
    if (
      !Array.isArray(result) ||
      result.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          (endpoint === "games" &&
            (!Number.isSafeInteger(item.id) ||
              typeof item.name !== "string" ||
              typeof item.slug !== "string")),
      )
    )
      throw new OperationalError("invalid_response");
    return result;
  } catch (error) {
    const code = deadline.aborted
      ? "timeout"
      : error instanceof SyntaxError
        ? "invalid_response"
        : operationalCode(error);
    reportOperationalError("game_source.request", code, error);
    throw linkMonitoringError(new OperationalError(code), error);
  }
}

// IGDB keyword ids for "unofficial", "fangame", "fanmade" and "mario fangame". Not "homebrew": that's
// also original indie games for retro consoles.
const FAN_KEYWORD_IDS = [2004, 24124, 27216, 25522];

const STANDALONE_TYPE_IDS = [...STANDALONE_TYPES].map((t) =>
  GAME_TYPES.indexOf(t),
);

// IGDB `date_formats.format` values.
const PRECISIONS: Record<string, DatePrecision> = {
  YYYYMMDD: "day",
  YYYYMM: "month",
  YYYY: "year",
  YYYYQ1: "quarter",
  YYYYQ2: "quarter",
  YYYYQ3: "quarter",
  YYYYQ4: "quarter",
  TBD: "tbd",
};

type IgdbReleaseDate = {
  game: number;
  date?: number;
  date_format?: { format: string };
  release_region?: { region: string };
  platform?: { name: string };
  status?: { name: string };
};

type IgdbGame = {
  id: number;
  game_type?: number;
  name: string;
  slug: string;
  summary?: string;
  cover?: { image_id: string };
  genres?: { id: number; name: string }[];
  player_perspectives?: number[];
  platforms?: { name: string }[];
  remasters?: {
    platforms?: { name: string }[];
    release_dates?: IgdbReleaseDate[];
  }[];
  ports?: {
    platforms?: { name: string }[];
    release_dates?: IgdbReleaseDate[];
  }[];
  similar_games?: number[];
  collections?: number[];
  franchises?: number[];
  game_modes?: number[];
  release_dates?: IgdbReleaseDate[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  total_rating_count?: number;
  hypes?: number;
  keywords?: number[];
  first_release_date?: number;
  themes?: number[];
  version_parent?: number;
  age_ratings?: {
    organization?: { name: string };
    rating_category?: { rating: string };
    rating_content_descriptions?: { description: string }[];
  }[];
  language_supports?: {
    language?: { name: string };
    language_support_type?: { name: string };
  }[];
};

const RELEASE_DATE_FIELDS = [
  "date",
  "date_format.format",
  "release_region.region",
  "platform.name",
  "status.name",
];

const GAME_FIELDS = [
  "game_type",
  "name",
  "slug",
  "summary",
  "cover.image_id",
  "genres.id",
  "genres.name",
  "player_perspectives",
  "platforms.name",
  "remasters.platforms.name",
  "ports.platforms.name",
  "aggregated_rating",
  "aggregated_rating_count",
  "rating",
  "rating_count",
  "total_rating_count",
  "hypes",
  "keywords",
  "first_release_date",
  "themes",
  "version_parent",
  "age_ratings.organization.name",
  "age_ratings.rating_category.rating",
  "age_ratings.rating_content_descriptions.description",
  "language_supports.language.name",
  "language_supports.language_support_type.name",
  ...RELEASE_DATE_FIELDS.map((f) => `release_dates.${f}`),
  ...["ports", "remasters"].flatMap((relation) =>
    RELEASE_DATE_FIELDS.map((field) => `${relation}.release_dates.${field}`),
  ),
].join(",");

const toReleaseDate = (d: IgdbReleaseDate): SourceReleaseDate => ({
  platform: d.platform?.name ?? null,
  region: d.release_region?.region ?? "worldwide",
  date: d.date === undefined ? null : new Date(d.date * 1000),
  precision:
    PRECISIONS[d.date_format?.format ?? ""] ??
    (d.date === undefined ? "tbd" : "day"),
  status: d.status?.name ?? null,
});

// IGDB `language_support_types` names.
const SUPPORT_FLAGS: Record<string, "voices" | "subtitles" | "interface"> = {
  Audio: "voices",
  Subtitles: "subtitles",
  Interface: "interface",
};

/** IGDB has one row per language and support type; fold them into one entry per language. */
function toLanguages(rows: IgdbGame["language_supports"] = []) {
  const byName = new Map<string, SourceLanguage>();
  for (const { language, language_support_type } of rows) {
    if (!language) continue;
    const entry = byName.get(language.name) ?? {
      name: language.name,
      voices: false,
      subtitles: false,
      interface: false,
    };
    const flag = SUPPORT_FLAGS[language_support_type?.name ?? ""];
    if (flag) entry[flag] = true;
    byName.set(language.name, entry);
  }
  return [...byName.values()];
}

/** GRAC "TESTING" is an IGDB placeholder, not a rating; ClassInd's "Violência (Violence)" keeps the English. */
function toAgeRatings(rows: IgdbGame["age_ratings"] = []): SourceAgeRating[] {
  return rows.flatMap(
    ({ organization, rating_category, rating_content_descriptions = [] }) =>
      organization && rating_category && rating_category.rating !== "TESTING"
        ? [
            {
              board: organization.name,
              rating: rating_category.rating,
              descriptors: rating_content_descriptions.map(
                ({ description }) =>
                  (organization.name === "CLASS_IND" &&
                    description.match(/\(([^)]+)\)\s*$/)?.[1]) ||
                  description,
              ),
            },
          ]
        : [],
  );
}

const toGame = (g: IgdbGame): SourceGame => ({
  id: g.id,
  type: GAME_TYPES[g.game_type ?? 0] ?? "main_game",
  title: g.name,
  slug: g.slug,
  summary: g.summary ?? null,
  coverImageId: g.cover?.image_id ?? null,
  genres: g.genres?.map((x) => x.name) ?? [],
  tags: GAME_TAGS.filter((tag) => {
    const mapping = IGDB_TAGS[tag.slug];
    const ids =
      mapping.field === "genres"
        ? g.genres?.map((genre) => genre.id)
        : g[mapping.field];
    return ids?.some((id) => mapping.ids.includes(id));
  }).map((tag) => tag.slug),
  // A remaster or port is logged as the base game on its platform (e.g. The Last of Us on PS5).
  platforms: [
    ...new Set(
      [g, ...(g.remasters ?? []), ...(g.ports ?? [])].flatMap(
        (x) => x.platforms?.map((p) => p.name) ?? [],
      ),
    ),
  ],
  releaseDates: [g, ...(g.ports ?? []), ...(g.remasters ?? [])].flatMap(
    (version) => version.release_dates?.map(toReleaseDate) ?? [],
  ),
  criticScore: g.aggregated_rating ?? null,
  criticScoreCount: g.aggregated_rating_count ?? null,
  userScore: g.rating ?? null,
  userScoreCount: g.rating_count ?? null,
  popularity: (g.total_rating_count ?? 0) + (g.hypes ?? 0),
  firstReleaseDate:
    g.first_release_date === undefined
      ? null
      : new Date(g.first_release_date * 1000),
  themes: g.themes ?? [],
  versionParent: g.version_parent ?? null,
  fanMade: g.keywords?.some((k) => FAN_KEYWORD_IDS.includes(k)) ?? false,
  ageRatings: toAgeRatings(g.age_ratings),
  languages: toLanguages(g.language_supports),
});

/**
 * The live GameSource. Search already asks IGDB for standalone, official, non-version games only,
 * so DLC and fan games don't use up the results the Catalog ranks.
 */
const RECOMMENDATION_FIELDS = [
  GAME_FIELDS,
  "similar_games",
  "collections",
  "franchises",
  "game_modes",
].join(",");
const toRecommendation = (g: IgdbGame): RecommendationGame => ({
  game: {
    ...toGame(g),
    popularity: g.total_rating_count ?? 0,
  },
  similar: g.similar_games ?? [],
  series: g.collections ?? [],
  franchises: g.franchises ?? [],
  genres: g.genres?.map((genre) => genre.id) ?? [],
  themes: g.themes ?? [],
  perspectives: g.player_perspectives ?? [],
  modes: g.game_modes ?? [],
});

export const igdbGameSource: GameSource = {
  async fetchRecommendationSeeds(ids, signal) {
    if (!ids.length) return [];
    const games = await igdb<IgdbGame>(
      "games",
      `fields ${RECOMMENDATION_FIELDS}; where id = (${ids.slice(0, 12).map(Math.trunc).join(",")}); limit 12;`,
      signal,
    );
    return games.map(toRecommendation);
  },
  async fetchRecommendationPage(query, page, signal) {
    const routes = [
      ["id", query.similar],
      ["collections", query.series],
      ["franchises", query.franchises],
      ["genres", query.genres],
      ["themes", query.themes],
      ["player_perspectives", query.perspectives],
      ["game_modes", query.modes],
    ] as const;
    const relationships = routes
      .filter(([, ids]) => ids.length)
      .map(
        ([field, ids]) =>
          `${field} = (${ids.slice(0, 120).map(Math.trunc).join(",")})`,
      );
    if (!query.popular && !relationships.length)
      return { games: [], hasMore: false };
    const filters = [
      `game_type = (${STANDALONE_TYPE_IDS})`,
      "version_parent = null",
      `keywords != (${FAN_KEYWORD_IDS})`,
      "themes != (42)",
      `first_release_date <= ${Math.floor(Date.now() / 1000)}`,
      ...(!query.popular ? [`(${relationships.join(" | ")})`] : []),
      ...(query.genre ? [`genres.name = ${JSON.stringify(query.genre)}`] : []),
      ...(query.platform
        ? [
            `(platforms.name = ${JSON.stringify(query.platform)} | ports.platforms.name = ${JSON.stringify(query.platform)} | remasters.platforms.name = ${JSON.stringify(query.platform)})`,
          ]
        : []),
    ];
    const games = await igdb<IgdbGame>(
      "games",
      `fields ${RECOMMENDATION_FIELDS}; where ${filters.join(" & ")}; sort total_rating_count desc; limit 100; offset ${Math.max(0, Math.min(3, Math.trunc(page))) * 100};`,
      signal,
    );
    return {
      games: games.map(toRecommendation),
      hasMore: games.length === 100,
    };
  },
  async mapSteamApps(appids, signal) {
    const result: SteamMapping[] = [];
    const ids = [...new Set(appids)];
    for (let start = 0; start < ids.length; start += 500) {
      const batch = ids.slice(start, start + 500);
      for (let afterId = 0; ; ) {
        const page = await igdb<{
          id: number;
          uid: string;
          game?: {
            id: number;
            game_type?: number;
            version_parent?: number;
            parent_game?: number;
          };
        }>(
          "external_games",
          `fields uid,game.id,game.game_type,game.version_parent,game.parent_game; where external_game_source = 1 & uid = (${batch.map((id) => `"${Math.trunc(id)}"`).join(",")}) & id > ${afterId}; sort id asc; limit 500;`,
          signal,
        );
        for (const row of page) {
          if (
            !Number.isSafeInteger(row.id) ||
            typeof row.uid !== "string" ||
            !batch.includes(Number(row.uid)) ||
            !row.game ||
            !Number.isSafeInteger(row.game.id)
          )
            throw new OperationalError("invalid_response");
          result.push({
            appid: Number(row.uid),
            gameId: row.game.id,
            type: GAME_TYPES[row.game.game_type ?? 0] ?? "update",
            versionParent: row.game.version_parent,
            parentGame: row.game.parent_game,
          });
        }
        if (page.length < 500) break;
        const next = Math.max(...page.map((row) => row.id));
        if (next <= afterId) throw new OperationalError("invalid_response");
        afterId = next;
      }
    }
    return result;
  },
  async fetchTagGames(slug, count, signal) {
    signal.throwIfAborted();
    const known = GAME_TAGS.find((tag) => tag.slug === slug);
    const tag = known && IGDB_TAGS[known.slug];
    if (!tag) return [];
    const games = await igdb<IgdbGame>(
      "games",
      `fields ${GAME_FIELDS}; where ${tag.field} = (${tag.ids}) & game_type = (${STANDALONE_TYPE_IDS}) & version_parent = null & keywords != (${FAN_KEYWORD_IDS}) & themes != (42) & cover != null; sort total_rating_count desc; limit ${Math.max(1, Math.min(500, Math.trunc(count)))};`,
      signal,
    );
    signal.throwIfAborted();
    // IGDB rejects multi-field sorting; tag popularity counts ratings, excluding hypes.
    return games
      .map((g) => ({ ...toGame(g), popularity: g.total_rating_count ?? 0 }))
      .sort(compareTagGames);
  },
  async fetchDiscoveryRanks(excludedIds, signal) {
    signal.throwIfAborted();
    // IGDB supports ID exclusions, but rejects value filters and multi-field sorting.
    const excluded = [...new Set(excludedIds)].map(Math.trunc);
    const page = await igdb<{ game_id: number; value: number }>(
      "popularity_primitives",
      `fields game_id,value; where popularity_type = 1${excluded.length ? ` & game_id != (${excluded.join(",")})` : ""}; sort value desc; limit 500;`,
      signal,
    );
    signal.throwIfAborted();
    return {
      ranks: page.map((r) => ({ gameId: r.game_id, visits: r.value })),
      hasMore: page.length === 500,
    };
  },
  async fetchRecentCandidates(afterId, from, through, signal) {
    signal.throwIfAborted();
    const page = await igdb<IgdbGame>(
      "games",
      `fields ${GAME_FIELDS}; where id > ${Math.trunc(afterId)} & first_release_date >= ${Math.ceil(from.getTime() / 1000)} & first_release_date <= ${Math.floor(through.getTime() / 1000)} & game_type = (${STANDALONE_TYPE_IDS}) & version_parent = null & keywords != (${FAN_KEYWORD_IDS}) & themes != (42) & cover != null; sort id asc; limit 500;`,
      signal,
    );
    signal.throwIfAborted();
    return { games: page.map(toGame), hasMore: page.length === 500 };
  },
  async fetchVisits(ids, signal) {
    const ranks = [];
    const unique = [...new Set(ids)].map(Math.trunc);
    for (let start = 0; start < unique.length; start += 500) {
      const batch = unique.slice(start, start + 500);
      // One Visits primitive per game; cursor through IDs if the batch fills a page.
      for (let afterId = 0; ; ) {
        signal.throwIfAborted();
        const page = await igdb<{ game_id: number; value: number }>(
          "popularity_primitives",
          `fields game_id,value; where popularity_type = 1 & game_id = (${batch.join(",")}) & game_id > ${afterId}; sort game_id asc; limit 500;`,
          signal,
        );
        signal.throwIfAborted();
        ranks.push(
          ...page.map((r) => ({ gameId: r.game_id, visits: r.value })),
        );
        if (page.length < 500) break;
        const nextId = Math.max(...page.map((r) => r.game_id));
        if (nextId <= afterId)
          throw new Error("Visits source returned a non-progressing page");
        afterId = nextId;
      }
    }
    return ranks;
  },
  async fetchGames(ids, signal) {
    const games: SourceGame[] = [];
    const unique = [...new Set(ids)];
    for (let start = 0; start < unique.length; start += 500) {
      signal.throwIfAborted();
      const page = await igdb<IgdbGame>(
        "games",
        `fields ${GAME_FIELDS}; where id = (${unique
          .slice(start, start + 500)
          .map(Math.trunc)
          .join(",")}); limit 500;`,
        signal,
      );
      signal.throwIfAborted();
      games.push(...page.map(toGame));
    }
    return games;
  },
  async search(query) {
    const deadline = requestSignal();
    const q = query.replace(/["\\]/g, "").trim().replace(/\s+/g, " ");
    if (!q) return [];
    const words = q.split(" ");
    const queries = [q];
    // Bound fallback traffic; IGDB misses split compounds such as "Soul Silver".
    for (let i = words.length - 2; i >= 0 && queries.length < 4; i--) {
      queries.push(
        [
          ...words.slice(0, i),
          words[i] + words[i + 1],
          ...words.slice(i + 2),
        ].join(" "),
      );
    }
    for (const variant of queries) {
      const games = await igdb<IgdbGame>(
        "games",
        `search "${variant}"; fields ${GAME_FIELDS}; where game_type = (${STANDALONE_TYPE_IDS}) & version_parent = null & keywords != (${FAN_KEYWORD_IDS}); limit 50;`,
        deadline,
      );
      if (games.length) return games.map(toGame);
    }
    return [];
  },

  async fetchGame(id) {
    const [game] = await igdb<IgdbGame>(
      "games",
      `fields ${GAME_FIELDS}; where id = ${Math.trunc(id)};`,
    );
    return game ? toGame(game) : null;
  },

  async fetchBySlug(slug) {
    // Slugs come from the URL; anything else can't be an IGDB slug and must not reach the query.
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    const [game] = await igdb<IgdbGame>(
      "games",
      `fields ${GAME_FIELDS}; where slug = "${slug}";`,
    );
    return game ? toGame(game) : null;
  },

  async fetchReleaseDates(ids, signal) {
    const deadline = requestSignal(signal);
    const byGame = new Map<number, SourceReleaseDate[]>(
      ids.map((id) => [id, []]),
    );
    if (ids.length === 0) return byGame;
    // IGDB returns at most 500 per request; page until a short page, in a stable order.
    for (let offset = 0; ; offset += 500) {
      const dates = await igdb<IgdbReleaseDate>(
        "release_dates",
        `fields game,${RELEASE_DATE_FIELDS.join(",")}; where game = (${ids.map(Math.trunc).join(",")}); sort id asc; limit 500; offset ${offset};`,
        deadline,
      );
      for (const d of dates) byGame.get(d.game)?.push(toReleaseDate(d));
      if (dates.length < 500) return byGame;
    }
  },
};
