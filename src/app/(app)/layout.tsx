import { requireUser } from "@/lib/auth/session";
import { parseSettings } from "@/lib/settings";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { AppNav } from "@/components/shell/app-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle();
  const settings = parseSettings(profile?.settings);

  return (
    <SettingsProvider initial={settings}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3"
      >
        Aller au contenu
      </a>
      <div className="flex min-h-dvh">
        <AppNav />
        <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
          {children}
        </main>
      </div>
    </SettingsProvider>
  );
}
