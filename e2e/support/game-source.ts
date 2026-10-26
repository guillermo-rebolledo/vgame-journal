import {
  createFakeGameSource,
  sourceGame,
} from "../../src/test/fake-game-source";

export const igdbGameSource = createFakeGameSource([
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
