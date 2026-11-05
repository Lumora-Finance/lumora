import AfricasTalking from "africastalking";

import type { SmsSender } from "./jobs";

export function createSmsSender(): SmsSender {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  if (!username || !apiKey) throw new Error("AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY must be set");
  const client = AfricasTalking({ username, apiKey });
  return {
    async send(phone, body) {
      await client.SMS.send({
        to: [phone],
        message: body,
        from: process.env.AFRICASTALKING_SENDER_ID || undefined,
      });
    },
  };
}
