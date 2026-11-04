import { notFound } from "next/navigation";
import { SearchPrototype } from "@/components/prototypes/game-search/picker";

export const metadata = {
  title: "Game search prototypes",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SearchPrototype />;
}
