import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { signUpAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Créer mon compte" };

export default function InscriptionPage() {
  return (
    <>
      <h1 className="text-center text-2xl font-bold">Créer ton compte</h1>
      <p className="text-center text-muted-foreground">
        Fil est privé : seules les adresses invitées peuvent s&apos;inscrire.
      </p>
      <AuthForm
        action={signUpAction}
        fields={[
          { name: "email", label: "Ton e-mail", autoComplete: "email" },
          {
            name: "password",
            label: "Choisis un mot de passe",
            autoComplete: "new-password",
            hint: "10 caractères minimum, avec au moins une lettre et un chiffre.",
          },
        ]}
        submitLabel="Créer mon compte"
        pendingLabel="Création…"
        footer={[{ href: "/connexion", label: "J'ai déjà un compte" }]}
      />
    </>
  );
}
