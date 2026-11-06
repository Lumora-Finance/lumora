/**
 * Legacy re-export — the dashboard used to have its own bell.
 * All callers now import from @/components/notifications/notification-bell.
 * This shim keeps any leftover imports working.
 */
export { NotificationBell } from "@/components/notifications/notification-bell";
