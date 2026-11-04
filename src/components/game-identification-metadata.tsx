import { PlatformName } from "@/components/platform";

/** Render beside the game's link: the platform disclosure must not be nested inside it. */
export function GameIdentificationMetadata({
  title,
  year,
  platforms,
  selectedPlatform,
}: {
  title: string;
  year: number | null;
  platforms: string[];
  selectedPlatform?: string;
}) {
  const primary =
    selectedPlatform && platforms.includes(selectedPlatform)
      ? selectedPlatform
      : platforms[0];
  const remaining = platforms.filter((platform) => platform !== primary);
  return (
    <div className="flex min-w-0 flex-col gap-1 text-muted-foreground text-sm [overflow-wrap:anywhere]">
      <p className="tabular-nums">{year ?? "Year unavailable"}</p>
      <p>
        {primary ? (
          <PlatformName platform={primary} compact />
        ) : (
          "Platform availability unknown"
        )}
      </p>
      {remaining.length > 0 && (
        <details>
          <summary
            aria-label={`+${remaining.length} ${remaining.length === 1 ? "platform" : "platforms"} — More platforms for ${title}`}
            className="min-h-11 cursor-pointer content-center rounded-md py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            +{remaining.length}{" "}
            {remaining.length === 1 ? "platform" : "platforms"}
          </summary>
          <ul
            aria-label={`Additional platforms for ${title}`}
            className="flex flex-wrap gap-x-3 gap-y-2 pb-2"
          >
            {remaining.map((platform) => (
              <li key={platform} className="min-w-0 max-w-full">
                <PlatformName platform={platform} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
