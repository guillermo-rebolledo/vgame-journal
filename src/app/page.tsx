import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="font-semibold text-4xl tracking-tight sm:text-6xl">
        {SITE_NAME}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {SITE_DESCRIPTION}
      </p>
    </section>
  );
}
