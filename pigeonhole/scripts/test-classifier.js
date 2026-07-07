#!/usr/bin/env node
/**
 * Smoke test for the Pigeonhole classifier: builds a synthetic mailbox
 * (a dozen "project" folders, many senders), trains, and checks that
 * held-out messages rank their true folder first / in the top 5.
 *
 *   node scripts/test-classifier.js
 */

"use strict";

const C = require("../addin/src/classifier.js");

// ---- synthetic mailbox ----------------------------------------------------

const FOLDERS = [
  { id: "f-acme", name: "Projects/Acme Tower", senders: ["pm@acmebuild.com", "rfi@acmebuild.com", "j.ortiz@steelworks.net"], words: ["acme", "tower", "rfi", "submittal", "steel", "schedule"] },
  { id: "f-brookside", name: "Projects/Brookside Solar", senders: ["ops@brooksideenergy.com", "permits@countyplanning.gov"], words: ["brookside", "solar", "array", "interconnect", "permit", "inverter"] },
  { id: "f-carlton", name: "Projects/Carlton Retrofit", senders: ["facilities@carlton.edu", "bids@hvacpro.com"], words: ["carlton", "retrofit", "hvac", "bid", "chiller", "scope"] },
  { id: "f-invoices", name: "Finance/Invoices", senders: ["billing@quickbooks.com", "invoices@vendorhub.io", "ap@steelworks.net"], words: ["invoice", "payment", "due", "statement", "balance"] },
  { id: "f-hr", name: "Internal/HR", senders: ["hr@mycompany.com", "benefits@gusto.com"], words: ["benefits", "enrollment", "payroll", "policy", "holiday"] },
  { id: "f-newsletters", name: "Reading/Newsletters", senders: ["news@construction-dive.com", "digest@enr.com"], words: ["weekly", "roundup", "industry", "trends", "issue"] },
  { id: "f-travel", name: "Admin/Travel", senders: ["noreply@delta.com", "reservations@marriott.com"], words: ["itinerary", "confirmation", "flight", "reservation", "checkin"] },
  { id: "f-permits", name: "Projects/Permitting", senders: ["permits@cityhall.gov", "review@fireauthority.org"], words: ["permit", "application", "review", "inspection", "approval", "zoning"] },
  { id: "f-legal", name: "Internal/Legal", senders: ["counsel@lawllp.com"], words: ["contract", "amendment", "liability", "redline", "agreement"] },
  { id: "f-devon", name: "Projects/Devon Bridge", senders: ["engineer@devonbridge.org", "pm@acmebuild.com"], words: ["devon", "bridge", "girder", "survey", "traffic", "phase"] },
  { id: "f-it", name: "Internal/IT", senders: ["helpdesk@mycompany.com", "alerts@microsoft.com"], words: ["password", "ticket", "outage", "vpn", "reset"] },
  { id: "f-receipts", name: "Finance/Receipts", senders: ["receipts@uber.com", "no-reply@amazon.com"], words: ["receipt", "order", "shipped", "total", "purchase"] }
];

let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

function makeMsg(folder) {
  const n = 2 + Math.floor(rand() * 3);
  const words = [];
  for (let i = 0; i < n; i++) words.push(pick(folder.words));
  const sender = pick(folder.senders);
  return {
    senderAddress: sender,
    senderName: sender.split("@")[0].replace(/[._]/g, " "),
    subject: (rand() < 0.3 ? "RE: " : "") + words.join(" ") + " " + Math.floor(rand() * 900),
    toAddresses: ["me@mycompany.com"],
    ccAddresses: rand() < 0.2 ? [pick(folder.senders)] : []
  };
}

// ---- train / evaluate ------------------------------------------------------

const trainSamples = [];
const testSamples = [];
const meta = {};

FOLDERS.forEach((f) => {
  meta[f.id] = { displayName: f.name.split("/").pop(), path: f.name.replace("/", " / ") };
  for (let i = 0; i < 40; i++) trainSamples.push({ folderId: f.id, msg: makeMsg(f) });
  for (let i = 0; i < 12; i++) testSamples.push({ folderId: f.id, msg: makeMsg(f) });
});

const t0 = Date.now();
const model = C.train(trainSamples, meta);
const trainMs = Date.now() - t0;

let top1 = 0, top5 = 0;
const t1 = Date.now();
testSamples.forEach((s) => {
  const ranked = C.rank(model, s.msg);
  const idx = ranked.findIndex((r) => r.folderId === s.folderId);
  if (idx === 0) top1++;
  if (idx > -1 && idx < 5) top5++;
});
const rankMs = Date.now() - t1;

const n = testSamples.length;
console.log(`trained on ${model.totalDocs} msgs / ${FOLDERS.length} folders in ${trainMs} ms (vocab ${model.vocabSize})`);
console.log(`ranked ${n} held-out msgs in ${rankMs} ms`);
console.log(`top-1 accuracy: ${(100 * top1 / n).toFixed(1)}%  (${top1}/${n})`);
console.log(`top-5 accuracy: ${(100 * top5 / n).toFixed(1)}%  (${top5}/${n})`);

// Incremental learning: a brand-new sender filed once should be findable.
const novel = {
  senderAddress: "newclient@zenithcorp.com",
  senderName: "Zenith Corp",
  subject: "Zenith warehouse expansion kickoff",
  toAddresses: ["me@mycompany.com"], ccAddresses: []
};
C.learnOne(model, "f-acme", novel);
const after = C.rank(model, novel);
const learned = after[0].folderId === "f-acme";
console.log(`learn-one reinforcement: ${learned ? "ok" : "FAILED"}`);

const pass = top1 / n >= 0.85 && top5 / n >= 0.98 && learned;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
