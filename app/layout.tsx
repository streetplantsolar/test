import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Comn.one — share what you have",
  description:
    "A trust-based sharing shelf for friends and neighbors. Lend books, tools, games, and more to the people you already care about.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const unread = user ? unreadCount(user.id) : 0;

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href={user ? "/home" : "/"} className="wordmark">
              comn<em>.one</em>
            </Link>
            <nav className="topnav">
              {user ? (
                <>
                  <Link href="/home">Borrow</Link>
                  <Link href="/shelf">My shelf</Link>
                  <Link href="/loans">Loans</Link>
                  <Link href="/people">People</Link>
                  <Link href="/circles">Circles</Link>
                  <Link href="/notifications">
                    Inbox{unread > 0 && <span className="badge-dot">{unread}</span>}
                  </Link>
                  <Link href="/settings">@{user.username}</Link>
                </>
              ) : (
                <>
                  <Link href="/support">Why free?</Link>
                  <Link href="/login">Sign in</Link>
                  <Link href="/join">Join</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
