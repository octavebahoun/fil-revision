import { requireUser } from "@/lib/auth/session";
import { parseSettings } from "@/lib/settings";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { OfflineBanner } from "@/components/common/offline-banner";

/** Écrans de concentration (session) : pas de navigation, une seule chose à la fois. */
export default async function FocusLayout({ children }: LayoutProps<"/">) {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle();
  return (
    <SettingsProvider initial={parseSettings(profile?.settings)}>
      <OfflineBanner />
      <main id="contenu" className="mx-auto w-full max-w-2xl px-4 pt-4 pb-6 md:pt-10">
        {children}
      </main>
    </SettingsProvider>
  );
}
