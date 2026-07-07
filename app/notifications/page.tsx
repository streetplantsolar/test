import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/lib/actions";
import { notificationsOf, unreadCount } from "@/lib/queries";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = notificationsOf(user.id);
  const unread = unreadCount(user.id);

  return (
    <>
      <h1>Inbox</h1>
      {unread > 0 && (
        <form action={markAllRead}>
          <button type="submit" className="quiet">
            Mark all {unread} as read
          </button>
        </form>
      )}
      {notifications.length === 0 ? (
        <p className="muted">
          All quiet. Requests, approvals, and return reminders land here (reminders arrive as due
          dates get close).
        </p>
      ) : (
        <ul className="plain">
          {notifications.map((n) => (
            <li key={n.id} style={n.read ? { opacity: 0.65 } : undefined}>
              <span className="grow">
                {n.href ? <Link href={n.href}>{n.body}</Link> : n.body}
              </span>
              <span className="muted small">{new Date(n.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
