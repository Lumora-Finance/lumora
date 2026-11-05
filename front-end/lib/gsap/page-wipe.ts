import { gsap, isReducedMotion } from "./effects";

const ID = "page-wipe";
/** If the next page never takes over, such as a failed navigation, the screen must not stay covered. */
const GIVE_UP_MS = 6000;

let giveUp: ReturnType<typeof setTimeout> | undefined;

/**
 * Grows a green panel out of the thing that was tapped until it fills the screen, then calls
 * `onCovered`. The panel stays up across the navigation, and the next page calls `wipeAway`. It lives
 * on the body so it survives the route change. With reduced motion there's no panel at all.
 */
export function wipeFrom(origin: DOMRect, label: string, onCovered: () => void) {
  if (isReducedMotion()) {
    onCovered();
    return;
  }
  document.getElementById(ID)?.remove();

  const panel = document.createElement("div");
  panel.id = ID;
  panel.setAttribute("aria-hidden", "true");
  panel.className = "fixed inset-0 z-[60] flex flex-col items-center justify-center bg-field text-paper";
  panel.innerHTML = `
    <span class="block overflow-hidden pb-1">
      <span data-wipe="label" class="block px-6 text-center font-display text-[34px] leading-[1.2] font-medium sm:text-[48px]"></span>
    </span>
    <span class="mt-4 flex w-40 flex-col items-center gap-1.5 sm:w-56">
      <span data-wipe="line" class="block h-1 w-full origin-center rounded-full bg-sage"></span>
      <span data-wipe="line" class="block h-1 w-[70%] origin-center rounded-full bg-sage"></span>
      <span data-wipe="line" class="block h-1 w-[42%] origin-center rounded-full bg-sage"></span>
    </span>`;
  (panel.querySelector('[data-wipe="label"]') as HTMLElement).textContent = label;
  document.body.append(panel);

  const { innerWidth: width, innerHeight: height } = window;
  const inset = (top: number, right: number, bottom: number, left: number, round: number) =>
    `inset(${top}px ${right}px ${bottom}px ${left}px round ${round}px)`;

  gsap
    .timeline()
    .fromTo(
      panel,
      { clipPath: inset(origin.top, width - origin.right, height - origin.bottom, origin.left, 20) },
      { clipPath: inset(0, 0, 0, 0, 0), duration: 0.62, ease: "expo.inOut" },
      0,
    )
    .fromTo(panel.querySelector('[data-wipe="label"]'), { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: "expo.out" }, 0.34)
    .fromTo(panel.querySelectorAll('[data-wipe="line"]'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "expo.out", stagger: 0.05 }, 0.4)
    .call(onCovered, undefined, 0.62);

  clearTimeout(giveUp);
  giveUp = setTimeout(wipeAway, GIVE_UP_MS);
}

const LIFT_MS = 600;

/**
 * Lifts the panel off the page beneath. Returns true if there was one, so the page can time its
 * entrance. Called from inside useGSAP, whose cleanup would cancel a GSAP tween started here, and React
 * runs effects twice in development. So this uses the browser's own animation, which nothing cancels,
 * and removes the panel on a timer as well, so the screen can never stay covered.
 */
export function wipeAway(): boolean {
  const panel = document.getElementById(ID);
  if (!panel) return false;
  if (panel.dataset.leaving) return true;
  panel.dataset.leaving = "true";
  clearTimeout(giveUp);
  gsap.killTweensOf(panel);

  panel.animate(
    { clipPath: ["inset(0% 0% 0% 0%)", "inset(0% 0% 100% 0%)"] },
    { duration: LIFT_MS, delay: 60, easing: "cubic-bezier(0.87, 0, 0.13, 1)", fill: "forwards" },
  );
  setTimeout(() => panel.remove(), LIFT_MS + 120);
  return true;
}
