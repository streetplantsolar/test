"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

async function lookupIsbn(isbn: string) {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!res.ok) throw new Error("not found");
  const data = await res.json();
  let description = "";
  if (typeof data.description === "string") description = data.description;
  else if (data.description?.value) description = data.description.value;
  if (!description && data.by_statement) description = String(data.by_statement);
  return {
    title: String(data.title ?? ""),
    description: description.slice(0, 300),
  };
}

export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(true);
  const [manualIsbn, setManualIsbn] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;

    (async () => {
      try {
        const Detector = window.BarcodeDetector;
        if (!Detector) throw new Error("no detector");
        const detector = new Detector({ formats: ["ean_13", "isbn", "upc_a"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        timer = setInterval(async () => {
          if (done || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const isbn = codes.map((c) => c.rawValue).find((v) => /^\d{10,13}$/.test(v));
            if (isbn) {
              done = true;
              setStatus(`Found ${isbn} — looking it up…`);
              await goToPrefill(isbn);
            }
          } catch {
            /* keep scanning */
          }
        }, 400);
      } catch {
        setSupported(false);
        setScanning(false);
        setStatus("Camera scanning isn't available here — type the ISBN below instead.");
      }
    })();

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function goToPrefill(isbn: string) {
    try {
      const info = await lookupIsbn(isbn);
      const params = new URLSearchParams({
        title: info.title,
        category: "book",
        description: info.description,
      });
      router.push(`/shelf/new?${params.toString()}`);
    } catch {
      setStatus(`Couldn't find ISBN ${isbn} on Open Library. You can still add it by hand.`);
      setScanning(false);
    }
  }

  return (
    <div>
      {supported && (
        <p>
          {scanning ? (
            <button className="quiet" onClick={() => setScanning(false)}>
              Stop camera
            </button>
          ) : (
            <button onClick={() => setScanning(true)}>Start camera scan</button>
          )}
        </p>
      )}
      {scanning && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", maxWidth: "24rem", border: "1px solid var(--line-strong)", borderRadius: 4 }}
        />
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const isbn = manualIsbn.replace(/[^0-9Xx]/g, "");
          if (isbn.length < 10) {
            setStatus("That doesn't look like an ISBN.");
            return;
          }
          setStatus("Looking it up…");
          await goToPrefill(isbn);
        }}
      >
        <label htmlFor="isbn">Or type the ISBN</label>
        <input
          id="isbn"
          type="text"
          value={manualIsbn}
          onChange={(e) => setManualIsbn(e.target.value)}
          placeholder="9780140285000"
          style={{ maxWidth: "16rem", marginRight: "0.5rem" }}
        />
        <button type="submit" className="quiet">
          Look up
        </button>
      </form>
      {status && <p className="notice">{status}</p>}
    </div>
  );
}
