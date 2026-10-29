export type TagKind = "style" | "genre" | "theme" | "perspective";
export type Tag = {
  slug: string;
  label: string;
  kind: TagKind;
  broad?: boolean;
};

/** Closed vocabulary, ordered from distinctive styles to perspective. */
export const GAME_TAGS = [
  {
    slug: "roguelike",
    label: "Roguelike",
    kind: "style",
  },
  {
    slug: "metroidvania",
    label: "Metroidvania",
    kind: "style",
  },
  {
    slug: "soulslike",
    label: "Soulslike",
    kind: "style",
  },
  {
    slug: "dungeon-crawler",
    label: "Dungeon crawler",
    kind: "style",
  },
  {
    slug: "greek-mythology",
    label: "Greek mythology",
    kind: "style",
  },
  {
    slug: "deck-building",
    label: "Deck building",
    kind: "style",
  },
  {
    slug: "survival-horror",
    label: "Survival horror",
    kind: "style",
  },
  {
    slug: "bullet-hell",
    label: "Bullet hell",
    kind: "style",
  },
  {
    slug: "twin-stick-shooter",
    label: "Twin-stick shooter",
    kind: "style",
  },
  {
    slug: "immersive-sim",
    label: "Immersive sim",
    kind: "style",
  },
  {
    slug: "tactical-rpg",
    label: "Tactical RPG",
    kind: "style",
  },
  {
    slug: "jrpg",
    label: "JRPG",
    kind: "style",
  },
  {
    slug: "western-rpg",
    label: "Western RPG",
    kind: "style",
  },
  {
    slug: "action-rpg",
    label: "Action RPG",
    kind: "style",
  },
  {
    slug: "turn-based-combat",
    label: "Turn-based combat",
    kind: "style",
  },
  {
    slug: "real-time-combat",
    label: "Real-time combat",
    kind: "style",
  },
  {
    slug: "crafting",
    label: "Crafting",
    kind: "style",
  },
  {
    slug: "base-building",
    label: "Base building",
    kind: "style",
  },
  {
    slug: "city-building",
    label: "City building",
    kind: "style",
  },
  {
    slug: "farming",
    label: "Farming",
    kind: "style",
  },
  {
    slug: "fishing",
    label: "Fishing",
    kind: "style",
  },
  {
    slug: "time-travel",
    label: "Time travel",
    kind: "style",
  },
  {
    slug: "post-apocalyptic",
    label: "Post-apocalyptic",
    kind: "style",
  },
  {
    slug: "cyberpunk",
    label: "Cyberpunk",
    kind: "style",
  },
  {
    slug: "pixel-art",
    label: "Pixel art",
    kind: "style",
  },
  {
    slug: "puzzle-platformer",
    label: "Puzzle platformer",
    kind: "style",
  },
  {
    slug: "point-and-click",
    label: "Point-and-click",
    kind: "genre",
  },
  {
    slug: "fighting",
    label: "Fighting",
    kind: "genre",
  },
  {
    slug: "shooter",
    label: "Shooter",
    kind: "genre",
  },
  {
    slug: "music",
    label: "Music",
    kind: "genre",
  },
  {
    slug: "platform",
    label: "Platform",
    kind: "genre",
  },
  {
    slug: "puzzle",
    label: "Puzzle",
    kind: "genre",
  },
  {
    slug: "racing",
    label: "Racing",
    kind: "genre",
  },
  {
    slug: "real-time-strategy",
    label: "Real-time strategy",
    kind: "genre",
  },
  {
    slug: "rpg",
    label: "RPG",
    kind: "genre",
  },
  {
    slug: "simulator",
    label: "Simulator",
    kind: "genre",
  },
  {
    slug: "sport",
    label: "Sport",
    kind: "genre",
  },
  {
    slug: "strategy",
    label: "Strategy",
    kind: "genre",
  },
  {
    slug: "turn-based-strategy",
    label: "Turn-based strategy",
    kind: "genre",
  },
  {
    slug: "tactical",
    label: "Tactical",
    kind: "genre",
  },
  {
    slug: "hack-and-slash",
    label: "Hack and slash",
    kind: "genre",
  },
  {
    slug: "quiz-trivia",
    label: "Quiz/Trivia",
    kind: "genre",
  },
  {
    slug: "pinball",
    label: "Pinball",
    kind: "genre",
  },
  {
    slug: "adventure",
    label: "Adventure",
    kind: "genre",
    broad: true,
  },
  {
    slug: "indie",
    label: "Indie",
    kind: "genre",
    broad: true,
  },
  {
    slug: "arcade",
    label: "Arcade",
    kind: "genre",
  },
  {
    slug: "visual-novel",
    label: "Visual Novel",
    kind: "genre",
  },
  {
    slug: "card-and-board-game",
    label: "Card & Board Game",
    kind: "genre",
  },
  {
    slug: "moba",
    label: "MOBA",
    kind: "genre",
  },
  {
    slug: "action",
    label: "Action",
    kind: "theme",
    broad: true,
  },
  {
    slug: "fantasy",
    label: "Fantasy",
    kind: "theme",
  },
  {
    slug: "science-fiction",
    label: "Science fiction",
    kind: "theme",
  },
  {
    slug: "horror",
    label: "Horror",
    kind: "theme",
  },
  {
    slug: "thriller",
    label: "Thriller",
    kind: "theme",
  },
  {
    slug: "survival",
    label: "Survival",
    kind: "theme",
  },
  {
    slug: "historical",
    label: "Historical",
    kind: "theme",
  },
  {
    slug: "stealth",
    label: "Stealth",
    kind: "theme",
  },
  {
    slug: "comedy",
    label: "Comedy",
    kind: "theme",
  },
  {
    slug: "business",
    label: "Business",
    kind: "theme",
  },
  {
    slug: "drama",
    label: "Drama",
    kind: "theme",
  },
  {
    slug: "non-fiction",
    label: "Non-fiction",
    kind: "theme",
  },
  {
    slug: "sandbox",
    label: "Sandbox",
    kind: "theme",
  },
  {
    slug: "educational",
    label: "Educational",
    kind: "theme",
  },
  {
    slug: "kids",
    label: "Kids",
    kind: "theme",
  },
  {
    slug: "open-world",
    label: "Open world",
    kind: "theme",
  },
  {
    slug: "warfare",
    label: "Warfare",
    kind: "theme",
  },
  {
    slug: "party",
    label: "Party",
    kind: "theme",
  },
  {
    slug: "4x",
    label: "4X",
    kind: "theme",
  },
  {
    slug: "mystery",
    label: "Mystery",
    kind: "theme",
  },
  {
    slug: "romance",
    label: "Romance",
    kind: "theme",
  },
  {
    slug: "first-person",
    label: "First person",
    kind: "perspective",
  },
  {
    slug: "third-person",
    label: "Third person",
    kind: "perspective",
  },
  {
    slug: "isometric",
    label: "Isometric",
    kind: "perspective",
  },
  {
    slug: "side-view",
    label: "Side view",
    kind: "perspective",
  },
  {
    slug: "text",
    label: "Text",
    kind: "perspective",
  },
  {
    slug: "auditory",
    label: "Auditory",
    kind: "perspective",
  },
  {
    slug: "virtual-reality",
    label: "Virtual Reality",
    kind: "perspective",
  },
] as const satisfies readonly Tag[];

export type TagSlug = (typeof GAME_TAGS)[number]["slug"];

export type TagShelf = {
  tag: Tag;
  games: { id: number; title: string; slug: string; coverImageId: string }[];
};
