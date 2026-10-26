import {
  type DatePrecision,
  GAME_TYPES,
  type GameSource,
  type SourceGame,
  type SourceReleaseDate,
  STANDALONE_TYPES,
} from "@/lib/game-source";

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

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        task()
          .then(resolve, reject)
          .finally(() => {
            open--;
            pump();
          }),
      );
      pump();
    });
}

// ponytail: per server instance; IGDB's 4 req/s is app-wide, so several warm instances can exceed it. Move to a shared store (e.g. Upstash) if 429s show up.
const limit = createLimiter(4, 8);

let token: { value: string; expiresAt: number } | undefined;

async function accessToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID ?? "",
      client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  token = {
    value: access_token,
    expiresAt: Date.now() + (expires_in - 60) * 1000,
  };
  return token.value;
}

/** POSTs an Apicalypse query to an IGDB endpoint. */
async function igdb<T>(endpoint: string, body: string): Promise<T[]> {
  const res = await limit(async () =>
    fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
        Authorization: `Bearer ${await accessToken()}`,
      },
      body,
    }),
  );
  if (res.status === 401) token = undefined; // Revoked early; the next call fetches a new one.
  if (!res.ok)
    throw new Error(`IGDB ${endpoint} request failed: ${res.status}`);
  return res.json();
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
  genres?: { name: string }[];
  platforms?: { name: string }[];
  remasters?: { platforms?: { name: string }[] }[];
  ports?: { platforms?: { name: string }[] }[];
  release_dates?: IgdbReleaseDate[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
  total_rating_count?: number;
  hypes?: number;
  keywords?: number[];
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
  "genres.name",
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
  ...RELEASE_DATE_FIELDS.map((f) => `release_dates.${f}`),
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

const toGame = (g: IgdbGame): SourceGame => ({
  id: g.id,
  type: GAME_TYPES[g.game_type ?? 0] ?? "main_game",
  title: g.name,
  slug: g.slug,
  summary: g.summary ?? null,
  coverImageId: g.cover?.image_id ?? null,
  genres: g.genres?.map((x) => x.name) ?? [],
  // A remaster or port is logged as the base game on its platform (e.g. The Last of Us on PS5).
  platforms: [
    ...new Set(
      [g, ...(g.remasters ?? []), ...(g.ports ?? [])].flatMap(
        (x) => x.platforms?.map((p) => p.name) ?? [],
      ),
    ),
  ],
  releaseDates: g.release_dates?.map(toReleaseDate) ?? [],
  criticScore: g.aggregated_rating ?? null,
  criticScoreCount: g.aggregated_rating_count ?? null,
  userScore: g.rating ?? null,
  userScoreCount: g.rating_count ?? null,
  popularity: (g.total_rating_count ?? 0) + (g.hypes ?? 0),
  fanMade: g.keywords?.some((k) => FAN_KEYWORD_IDS.includes(k)) ?? false,
});

/**
 * The live GameSource. Search already asks IGDB for standalone, official, non-version games only,
 * so DLC and fan games don't use up the results the Catalog ranks.
 */
export const igdbGameSource: GameSource = {
  async search(query) {
    const q = query.replace(/["\\]/g, "");
    const games = await igdb<IgdbGame>(
      "games",
      `search "${q}"; fields ${GAME_FIELDS}; where game_type = (${STANDALONE_TYPE_IDS}) & version_parent = null & keywords != (${FAN_KEYWORD_IDS}); limit 50;`,
    );
    return games.map(toGame);
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

  async fetchReleaseDates(ids) {
    const byGame = new Map<number, SourceReleaseDate[]>(
      ids.map((id) => [id, []]),
    );
    if (ids.length === 0) return byGame;
    // ponytail: one request of up to 500 dates; callers batch ids (~50 games) to stay under it.
    const dates = await igdb<IgdbReleaseDate>(
      "release_dates",
      `fields game,${RELEASE_DATE_FIELDS.join(",")}; where game = (${ids.map(Math.trunc).join(",")}); limit 500;`,
    );
    for (const d of dates) byGame.get(d.game)?.push(toReleaseDate(d));
    return byGame;
  },
};
