"use client";

import { GameSearch } from "@/components/game-search";
import {
  HomeJournalFeedback,
  HomePendingSave,
} from "@/components/home-journal";

/** Catalog navigation retains the existing post-authentication save confirmation. */
export function HomeSearch() {
  return (
    <HomePendingSave>
      {(continuation) => (
        <GameSearch
          continuation={continuation}
          renderFeedback={(game) => <HomeJournalFeedback gameId={game?.id} />}
        />
      )}
    </HomePendingSave>
  );
}
