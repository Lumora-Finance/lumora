import { clock } from "../format";
import type { Template } from "./types";

/** Buyer: the farmer says the code isn't being given. */
export const nocodeBuyer: Template = (d) => ({
  subject: `${d.farmer} is at your gate`,
  lines: [
    `${d.farmer} is at your gate. Give them the code, or decline the delivery with a reason and photo.`,
    `You have until ${clock(d.respond_by as string)}. After that it goes to our team.`,
  ],
  buttons: [{ label: "Open the booking" }],
});
