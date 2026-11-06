import Image from "next/image";
import Link from "next/link";
import { type ReactNode, ViewTransition } from "react";

import { Num } from "@/components/landing/shared";

/**
 * The two view transitions sit before any DOM node, as they must to fire on navigation,
 * so the page lays out without a wrapper: the photo is fixed beside the form on desktop,
 * and hidden on smaller screens.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <ViewTransition enter="auth-form-in" exit="auth-form-out" default="none">
        <div className="flex flex-1 flex-col px-4 md:px-8 lg:min-h-svh lg:w-1/2 lg:px-14">
          <header className="flex h-16 items-center lg:h-20">
            <Link
              href="/"
              className="vt-logo inline-flex min-h-10 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Image
                src="/brand/lumora-mark.png"
                alt=""
                width={1024}
                height={945}
                preload
                className="h-6 w-auto md:h-7"
              />
              <span className="font-display text-xl font-medium">lumora</span>
            </Link>
          </header>

          <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-6 lg:py-10">
            {children}
          </main>

          <footer className="py-5 text-body-sm text-ink-muted">
            © <Num>2026</Num> Lumora
          </footer>
        </div>
      </ViewTransition>

      <ViewTransition name="farm-photo" share="farm-morph" default="none">
        {/* Pexels photo 33624059, free licence. Must not imply this person endorses Lumora. */}
        <aside className="hidden overflow-hidden rounded-2xl bg-field text-paper lg:fixed lg:top-3 lg:right-3 lg:bottom-3 lg:block lg:w-[calc(50%-1.5rem)]">
          <Image
            src="/images/signup.jpg"
            alt="A smiling woman in a large straw hat at a market in Jos"
            fill
            preload
            // The panel is hidden below lg, so small screens only preload the tiniest version.
            sizes="(min-width: 1024px) 50vw, 1px"
            className="object-cover object-[28%_20%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 hidden h-2/3 bg-linear-to-t from-field via-field/80 via-40% to-transparent lg:block"
          />
          <div className="absolute inset-x-0 bottom-0 hidden p-10 xl:p-12 lg:block">
            <p className="font-display text-display-lg font-medium text-balance">
              Know your buyer. <span className="text-sage">Then load the truck.</span>
            </p>
            <p className="mt-4 max-w-[30rem] text-lg leading-7">
              Bids, booked slots and payouts in one place, from the posted price to the bank
              transfer.
            </p>
            <p className="mt-8 flex items-center gap-3 font-medium">
              {/* The logo's green lines need a light surface. */}
              <span className="flex size-9 items-center justify-center rounded-md bg-paper">
                <Image
                  src="/brand/lumora-mark.png"
                  alt=""
                  width={48}
                  height={44}
                  className="h-6 w-auto"
                />
              </span>
              Buyers are waiting. What are you selling?
            </p>
          </div>
        </aside>
      </ViewTransition>
    </>
  );
}
