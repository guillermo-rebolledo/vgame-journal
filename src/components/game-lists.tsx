import { GameListPicker } from "@/components/game-list-picker";
import { currentSession } from "@/lib/auth";

export async function GameLists({
  game,
}: {
  game: { id: number; slug: string; title: string };
}) {
  const session = await currentSession();
  return (
    <GameListPicker
      actor={session?.user.username ? session.user.id : null}
      needsUsername={!!session && !session.user.username}
      game={game}
    />
  );
}
