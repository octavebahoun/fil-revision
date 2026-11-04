import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { updatePasswordAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function NouveauMotDePassePage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="text-2xl font-bold">Choisis ton mot de passe</h1>
      <AuthForm
        action={updatePasswordAction}
        fields={[
          {
            name: "password",
            label: "Nouveau mot de passe",
            autoComplete: "new-password",
            hint: "10 caractères minimum, avec au moins une lettre et un chiffre.",
          },
        ]}
        submitLabel="Enregistrer"
        pendingLabel="Enregistrement…"
        footer={[{ href: "/", label: "Aller à l'accueil" }]}
      />
    </div>
  );
}
