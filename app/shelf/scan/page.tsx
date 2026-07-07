import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Scanner } from "@/components/scanner";

export default async function ScanPage() {
  const user = await requireUser();

  if (!user.supporter) {
    return (
      <>
        <h1>Barcode scanning</h1>
        <p>
          Point your camera at a book&rsquo;s barcode and it lands on your shelf with the title
          and details filled in. It&rsquo;s one of the little conveniences we reserve for{" "}
          <strong>supporters</strong> — the people whose $0.99/month keeps Comn.one free for
          everyone else.
        </p>
        <p className="notice">
          Nothing essential lives behind this. Adding items by hand is free, always —{" "}
          <Link href="/shelf/new">add one now</Link>. If you&rsquo;d like the shortcuts (and to
          keep the lights on), <Link href="/support">become a supporter</Link>.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Scan a book</h1>
      <p className="muted">
        Aim your camera at the barcode. We look the ISBN up on Open Library and pre-fill your
        shelf form — you just hit save.
      </p>
      <Scanner />
    </>
  );
}
