export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  password_hash: string;
  place: string;
  bio: string;
  supporter: number;
  created_at: number;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: number;
}

export type CircleKind = "crew" | "neighborhood" | "city";

export interface Circle {
  id: string;
  name: string;
  kind: CircleKind;
  area: string;
  description: string;
  invite_code: string;
  created_by: string;
  created_at: number;
}

export type Visibility = "friends" | "neighbors";

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  description: string;
  care_notes: string;
  lend_days: number | null;
  visibility: Visibility;
  archived: number;
  created_at: number;
}

export type LoanStatus =
  | "requested"
  | "reserved"
  | "out"
  | "returned"
  | "declined"
  | "cancelled";

export interface Loan {
  id: string;
  item_id: string;
  borrower_id: string;
  status: LoanStatus;
  message: string;
  due_at: number | null;
  reminded_stage: number;
  created_at: number;
  reserved_at: number | null;
  out_at: number | null;
  closed_at: number | null;
}

export interface Notification {
  id: string;
  user_id: string;
  body: string;
  href: string;
  read: number;
  created_at: number;
}

export const CATEGORIES: [string, string][] = [
  ["book", "Book"],
  ["game", "Game"],
  ["music", "Music"],
  ["movie", "Movie & TV"],
  ["tool", "Tool"],
  ["kitchen", "Kitchen"],
  ["outdoors", "Outdoors"],
  ["kids", "Kids"],
  ["craft", "Craft & hobby"],
  ["tech", "Tech"],
  ["other", "Other"],
];

export function categoryLabel(slug: string): string {
  return CATEGORIES.find(([s]) => s === slug)?.[1] ?? "Other";
}
