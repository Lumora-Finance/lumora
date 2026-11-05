import type { MoneyDb, MoneyResult } from "@/lib/money/db";

import { AREAS } from "./areas";

const PAGE_SIZE = 5;
const pageCount = Math.ceil(AREAS.length / PAGE_SIZE);

type OnboardingState = { step: "name" | "area"; name: string | null; page: number };

export function areaMenu(page: number): string {
  const start = page * PAGE_SIZE;
  const options = AREAS.slice(start, start + PAGE_SIZE).map((area, index) => `${index + 1} ${area.name}`);
  const last = page >= pageCount - 1;
  return `Where is your farm? Reply with a number: ${options.join(", ")}, 6 ${last ? "Back" : "More"}`;
}

const WELCOME = "Welcome to Lumora. What is your name?";

/** Starts or continues sign-up by SMS. */
export async function continueSmsOnboarding(
  input: { phone: string; text: string; existing: { name: string } | null; now: Date },
  db: MoneyDb,
): Promise<string> {
  const { phone, existing } = input;
  const at = input.now.toISOString();
  const text = input.text.trim();
  const state = await db.rpc<OnboardingState | null>("logistics_sms_state", { p_phone: phone });

  const save = (step: string, name: string | null, page: number) =>
    db.rpc("logistics_sms_set", { p_phone: phone, p_step: step, p_name: name, p_page: page, p_now: at });

  if (!state) {
    if (existing) {
      await save("area", existing.name, 0);
      return areaMenu(0);
    }
    await save("name", null, 0);
    return WELCOME;
  }

  if (state.step === "name") {
    if (text.length < 2 || text.length > 60 || /\d/.test(text)) return "Please reply with your name.";
    await save("area", text, 0);
    return `Thank you, ${text}. ${areaMenu(0)}`;
  }

  const choice = /^\d$/.test(text) ? Number(text) : null;
  if (choice === 6) {
    const page = (state.page + 1) % pageCount;
    await save("area", state.name, page);
    return areaMenu(page);
  }
  const area = choice && choice >= 1 && choice <= 5 ? AREAS[state.page * PAGE_SIZE + choice - 1] : undefined;
  if (!area) return areaMenu(state.page);

  const result = await db.rpc<MoneyResult>("logistics_sms_finish", {
    p_phone: phone, p_name: state.name, p_area: area.name, p_now: at,
  });
  if (!result.ok) return "Something went wrong. Please try again.";
  return `Welcome, ${state.name}. We have you near ${area.name}. Send BUYERS CHICKEN to see who is buying.`;
}
