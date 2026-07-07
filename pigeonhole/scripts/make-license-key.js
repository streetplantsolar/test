#!/usr/bin/env node
/**
 * Generate a Pigeonhole license key. Run this from your payment
 * provider's webhook (Stripe / Paddle / Lemon Squeezy) after a purchase,
 * then email the key to the buyer.
 *
 *   node make-license-key.js buyer@example.com [YYYY-MM-DD]
 *
 * Expiry defaults to one year from today. VENDOR_SECRET must match
 * addin/src/license.js.
 */

"use strict";

const VENDOR_SECRET = "change-me-before-shipping";
const B32 = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function toB32(num, len) {
  let s = "";
  while (s.length < len) {
    s = B32[num % 32] + s;
    num = Math.floor(num / 32);
  }
  return s;
}

function makeKey(email, expiryDate) {
  const emailHash = toB32(fnv1a(email.toLowerCase().trim()), 6);
  const expiry =
    expiryDate.getFullYear().toString().padStart(4, "0") +
    (expiryDate.getMonth() + 1).toString().padStart(2, "0") +
    expiryDate.getDate().toString().padStart(2, "0");
  const payload = emailHash + expiry;
  const check = toB32(fnv1a(payload + "|" + VENDOR_SECRET), 6);
  return `PGNH-${payload}-${check}`;
}

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("usage: node make-license-key.js buyer@example.com [YYYY-MM-DD]");
  process.exit(1);
}

let expiry;
if (process.argv[3]) {
  expiry = new Date(process.argv[3] + "T00:00:00");
  if (isNaN(expiry)) {
    console.error("invalid expiry date, expected YYYY-MM-DD");
    process.exit(1);
  }
} else {
  expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
}

console.log(makeKey(email, expiry));
