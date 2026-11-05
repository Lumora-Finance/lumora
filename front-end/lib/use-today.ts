import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
let today: Date | null = null;
const getToday = () => (today ??= new Date());

/** Today, in the browser. Null while prerendering, so a page built earlier can't show the wrong date. */
export const useToday = () => useSyncExternalStore(subscribe, getToday, () => null);
