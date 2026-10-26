import {
  createFakeGameSource,
  sourceGame,
} from "../../src/test/fake-game-source";

// Fictional games with synthetic dates for Wishlist sections; not real release announcements.
const todayUtc = new Date(new Date().toISOString().slice(0, 10));
const synthetic = (
  id: number,
  title: string,
  date: Date | null,
  precision: "day" | "quarter" | "tbd",
) =>
  sourceGame({
    id,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    platforms: ["PC"],
    releaseDates: [
      { platform: "PC", region: "worldwide", date, precision, status: null },
    ],
  });

export const igdbGameSource = createFakeGameSource([
  synthetic(
    101,
    "The Lantern Keeper's Extraordinarily Long Voyage Across the Shattered Archipelago: Definitive Edition",
    todayUtc,
    "day",
  ),
  synthetic(102, "Tidewater Rangers", new Date("2099-07-01"), "quarter"),
  synthetic(103, "Moss Cartographer", null, "tbd"),
  sourceGame({
    id: 1,
    title: "Celeste",
    slug: "celeste",
    platforms: ["PC"],
    coverImageId: "co3byy",
    releaseDates: [
      {
        platform: "PC",
        region: "worldwide",
        date: new Date("2018-01-25"),
        precision: "day",
        status: null,
      },
    ],
  }),
  sourceGame({
    id: 2,
    title: "Silksong",
    slug: "silksong",
    platforms: ["PC"],
    releaseDates: [
      {
        platform: "PC",
        region: "worldwide",
        date: new Date("2027-06-01"),
        precision: "day",
        status: null,
      },
    ],
  }),
]);
