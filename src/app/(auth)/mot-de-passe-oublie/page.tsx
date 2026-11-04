import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { requestResetAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function OubliPage() {
  return (
    <>
      <h1 className="text-center text-2xl font-bold">Mot de passe oublié</h1>
      <p className="text-center text-muted-foreground">Ça arrive. Donne ton e-mail, on t&apos;envoie un lien.</p>
      <AuthForm
        action={requestResetAction}
        fields={[{ name: "email", label: "Ton e-mail", autoComplete: "email" }]}
        submitLabel="Recevoir le lien"
        pendingLabel="Envoi…"
        footer={[{ href: "/connexion", label: "Retour à la connexion" }]}
      />
    </>
  );
}
