import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo className="h-10 w-auto" />
        <p className="text-muted-foreground">Une chose à la fois. Reprends le fil.</p>
      </div>
      {children}
    </main>
  );
}
