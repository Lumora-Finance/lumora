import type { User } from "firebase/auth";

import { trackTask } from "@/lib/loading/progress";

/** Calls our own API as the signed-in user. */
export async function apiFetch(user: User, path: string, body?: unknown) {
  // Reads count towards what the loaders show. Actions have their own bar in the button.
  const finished = body === undefined ? trackTask(path.split("?")[0]) : () => {};
  try {
    const token = await user.getIdToken();
    return await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } finally {
    finished();
  }
}
