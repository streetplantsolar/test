/**
 * Pigeonhole — on-device email folder classifier.
 *
 * A multinomial Naive Bayes model over lightweight lexical features
 * (sender address, sender domain, sender display name, subject tokens,
 * recipient addresses). Everything runs in the taskpane; nothing ever
 * leaves the machine. Training on a few thousand messages takes seconds,
 * and scoring a message takes well under a millisecond.
 *
 * This module is dependency-free and host-agnostic (no Office.js, no DOM)
 * so it can be unit-tested in Node and reused for a Gmail port later.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PigeonholeClassifier = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MODEL_VERSION = 2;

  // Common noise words that carry no filing signal.
  var STOPWORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "is", "it", "its", "of", "on", "or", "our", "that", "the",
    "this", "to", "was", "we", "were", "will", "with", "you", "your", "hi",
    "hello", "dear", "thanks", "thank", "regards", "please", "new", "re",
    "fw", "fwd", "update", "updated", "notification", "reminder"
  ]);

  var SUBJECT_PREFIX = /^\s*((re|fw|fwd|aw|sv|vs)\s*(\[\d+\])?\s*:\s*)+/i;

  /** Normalize a subject line: strip reply/forward prefixes, lowercase. */
  function cleanSubject(subject) {
    return (subject || "").replace(SUBJECT_PREFIX, "").toLowerCase();
  }

  /** Tokenize free text into informative word tokens. */
  function tokenize(text) {
    if (!text) return [];
    var raw = text
      .toLowerCase()
      .split(/[^a-z0-9#&+._-]+/i)
      .map(function (t) { return t.replace(/^[._-]+|[._-]+$/g, ""); });
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var t = raw[i];
      if (t.length < 2 || t.length > 30) continue;
      if (STOPWORDS.has(t)) continue;
      if (/^\d+$/.test(t) && t.length > 6) continue; // long ids/timestamps
      out.push(t);
    }
    return out;
  }

  /**
   * Turn a message descriptor into a bag of weighted feature tokens.
   * Feature namespaces are prefixed so "acme" the sender-domain and
   * "acme" the subject word remain distinct features.
   *
   * @param {object} msg
   *   { senderAddress, senderName, subject, toAddresses:[], ccAddresses:[] }
   * @returns {string[]} feature tokens (repeats express weight)
   */
  function extractFeatures(msg) {
    var f = [];
    var addr = (msg.senderAddress || "").toLowerCase().trim();

    if (addr) {
      // Sender identity is the strongest routing signal — weight it heavily.
      pushN(f, "from:" + addr, 6);
      var at = addr.indexOf("@");
      if (at > -1) {
        var domain = addr.slice(at + 1);
        pushN(f, "dom:" + domain, 3);
        // Second-level domain groups mail.foo.com with foo.com.
        var parts = domain.split(".");
        if (parts.length > 2) {
          pushN(f, "dom2:" + parts.slice(-2).join("."), 2);
        }
        // Local-part tokens catch project+tag@ and noreply patterns.
        tokenize(addr.slice(0, at)).forEach(function (t) {
          f.push("lp:" + t);
        });
      }
    }

    tokenize(msg.senderName).forEach(function (t) { pushN(f, "name:" + t, 2); });
    tokenize(cleanSubject(msg.subject)).forEach(function (t) { f.push("subj:" + t); });

    // Which alias/list the mail arrived through is often decisive.
    (msg.toAddresses || []).slice(0, 8).forEach(function (a) {
      a = (a || "").toLowerCase().trim();
      if (a) f.push("to:" + a);
    });
    (msg.ccAddresses || []).slice(0, 8).forEach(function (a) {
      a = (a || "").toLowerCase().trim();
      if (a) f.push("cc:" + a);
    });

    return f;
  }

  function pushN(arr, token, n) {
    for (var i = 0; i < n; i++) arr.push(token);
  }

  /**
   * Train a multinomial Naive Bayes model.
   *
   * @param {Array<{folderId:string, msg:object}>} samples
   * @param {Object<string,{displayName:string,path:string}>} folderMeta
   * @returns model object (JSON-serializable)
   */
  function train(samples, folderMeta) {
    var docCount = {};        // folderId -> number of messages
    var tokenCount = {};      // folderId -> total feature tokens
    var freq = {};            // folderId -> { token -> count }
    var df = {};              // token -> number of folders containing it
    var total = 0;

    samples.forEach(function (s) {
      var fid = s.folderId;
      var feats = extractFeatures(s.msg);
      if (!feats.length) return;
      total++;
      docCount[fid] = (docCount[fid] || 0) + 1;
      tokenCount[fid] = (tokenCount[fid] || 0) + feats.length;
      var bag = freq[fid] || (freq[fid] = {});
      feats.forEach(function (t) { bag[t] = (bag[t] || 0) + 1; });
    });

    Object.keys(freq).forEach(function (fid) {
      Object.keys(freq[fid]).forEach(function (t) {
        df[t] = (df[t] || 0) + 1;
      });
    });

    // Prune singleton subject tokens to keep the model small; identity
    // features (from:/dom:/to:) are always kept — a single prior email
    // from a sender is meaningful.
    var vocab = {};
    Object.keys(freq).forEach(function (fid) {
      var bag = freq[fid];
      var kept = {};
      Object.keys(bag).forEach(function (t) {
        var isIdentity = t.indexOf("subj:") !== 0 && t.indexOf("name:") !== 0;
        if (isIdentity || bag[t] > 1 || df[t] > 1) {
          kept[t] = bag[t];
          vocab[t] = true;
        }
      });
      freq[fid] = kept;
    });

    return {
      version: MODEL_VERSION,
      trainedAt: new Date().toISOString(),
      totalDocs: total,
      vocabSize: Object.keys(vocab).length,
      docCount: docCount,
      tokenCount: tokenCount,
      freq: freq,
      folders: folderMeta || {}
    };
  }

  /**
   * Score a message against the model.
   *
   * @returns {Array<{folderId, displayName, path, score, confidence}>}
   *   All known folders, best first. `confidence` is a softmax-normalized
   *   probability across the candidate folders.
   */
  function rank(model, msg) {
    if (!model || !model.docCount) return [];
    var feats = extractFeatures(msg);
    var folderIds = Object.keys(model.docCount);
    if (!folderIds.length) return [];

    var vocabSize = Math.max(model.vocabSize || 1, 1);
    var scores = folderIds.map(function (fid) {
      var prior = Math.log(model.docCount[fid] / model.totalDocs);
      var denom = (model.tokenCount[fid] || 0) + vocabSize;
      var bag = model.freq[fid] || {};
      var ll = prior;
      for (var i = 0; i < feats.length; i++) {
        ll += Math.log(((bag[feats[i]] || 0) + 1) / denom);
      }
      return { folderId: fid, score: ll };
    });

    scores.sort(function (a, b) { return b.score - a.score; });

    // Softmax over log-likelihoods for a human-readable confidence.
    var max = scores[0].score;
    var sum = 0;
    scores.forEach(function (s) { s._e = Math.exp(s.score - max); sum += s._e; });
    scores.forEach(function (s) {
      s.confidence = s._e / sum;
      delete s._e;
      var meta = (model.folders || {})[s.folderId] || {};
      s.displayName = meta.displayName || "(unknown folder)";
      s.path = meta.path || s.displayName;
    });

    return scores;
  }

  /** Incrementally learn from one user-confirmed filing decision. */
  function learnOne(model, folderId, msg) {
    if (!model || !model.docCount) return model;
    var feats = extractFeatures(msg);
    if (!feats.length) return model;
    model.totalDocs = (model.totalDocs || 0) + 1;
    model.docCount[folderId] = (model.docCount[folderId] || 0) + 1;
    model.tokenCount[folderId] = (model.tokenCount[folderId] || 0) + feats.length;
    var bag = model.freq[folderId] || (model.freq[folderId] = {});
    feats.forEach(function (t) {
      if (bag[t] === undefined) model.vocabSize = (model.vocabSize || 0) + 1;
      bag[t] = (bag[t] || 0) + 1;
    });
    return model;
  }

  return {
    MODEL_VERSION: MODEL_VERSION,
    tokenize: tokenize,
    cleanSubject: cleanSubject,
    extractFeatures: extractFeatures,
    train: train,
    rank: rank,
    learnOne: learnOne
  };
});
