"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function AppNav() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <>
      {/* Bureau : barre latérale discrète */}
      <nav
        aria-label="Navigation principale"
        className="hide-in-focus sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r bg-card/60 px-3 py-6 md:flex"
      >
        <Link href="/" className="mb-6 px-3" aria-label="Fil, accueil">
          <Logo />
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-base text-muted-foreground hover:bg-muted hover:text-foreground",
              isActive(pathname, item.href) && "bg-secondary font-semibold text-secondary-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <form action={signOutAction} className="mt-auto">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-base text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-5" aria-hidden="true" />
            Me déconnecter
          </button>
        </form>
      </nav>

      {/* Mobile : barre du bas, à portée de pouce */}
      <nav
        aria-label="Navigation principale"
        className="hide-in-focus fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {primary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-sm text-muted-foreground",
                  isActive(pathname, item.href) && "font-semibold text-primary",
                )}
              >
                <item.icon className="size-6" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Sheet>
              <SheetTrigger className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
                <MoreHorizontal className="size-6" aria-hidden="true" />
                Plus
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <SheetHeader>
                  <SheetTitle>Plus</SheetTitle>
                </SheetHeader>
                <ul className="flex flex-col gap-1 px-4">
                  {secondary.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base hover:bg-muted"
                      >
                        <item.icon className="size-5" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <form action={signOutAction}>
                      <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base hover:bg-muted">
                        <LogOut className="size-5" aria-hidden="true" />
                        Me déconnecter
                      </button>
                    </form>
                  </li>
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </>
  );
}
