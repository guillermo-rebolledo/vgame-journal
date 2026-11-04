"use client";

import { GameSearch } from "@/components/game-search";
import {
  HomeJournalFeedback,
  HomePendingSave,
  HomeSaveControls,
} from "@/components/home-journal";

/** One Command surface owns both Catalog actions and the preserved auth intent. */
export function HomeSearch({ guidance }: { guidance: string }) {
  return (
    <HomePendingSave>
      {(continuation) => (
        <GameSearch
          guidance={guidance}
          continuation={continuation}
          renderFeedback={(game) => <HomeJournalFeedback gameId={game?.id} />}
          renderAction={(game) => (
            <HomeSaveControls
              presentation="direct"
              announce={false}
              game={{ ...game, gameId: game.id }}
            />
          )}
        />
      )}
    </HomePendingSave>
  );
}
