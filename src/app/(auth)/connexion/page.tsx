import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "@/lib/auth/actions";
import { safeNext } from "@/lib/auth/validation";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const suite = safeNext(sp.suite);
  const expired = sp.lien === "expire";
  return (
    <>
      <h1 className="text-center text-2xl font-bold">Content de te revoir</h1>
      {expired ? (
        <p role="status" className="rounded-xl bg-warning-soft px-4 py-3">
          Ce lien n&apos;est plus valable. Demande-en un nouveau, ça prend 10 secondes.
        </p>
      ) : null}
      <AuthForm
        action={signInAction}
        hidden={{ suite }}
        fields={[
          { name: "email", label: "Ton e-mail", autoComplete: "email" },
          { name: "password", label: "Ton mot de passe", autoComplete: "current-password" },
        ]}
        submitLabel="Me connecter"
        pendingLabel="Connexion…"
        footer={[
          { href: "/mot-de-passe-oublie", label: "Mot de passe oublié ?" },
          { href: "/inscription", label: "Créer mon compte" },
        ]}
      />
    </>
  );
}
