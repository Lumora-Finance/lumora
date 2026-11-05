import type { User } from "firebase/auth";

/** Calls our own API as the signed-in user. */
export async function apiFetch(user: User, path: string, body?: unknown) {
  const token = await user.getIdToken();
  return fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
