import { requireUser } from "@/lib/auth/session";

export default async function AccueilPage() {
  await requireUser();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Bonjour</h1>
      <p className="text-muted-foreground">Tes cours arrivent bientôt ici.</p>
    </section>
  );
}
