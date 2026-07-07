/**
 * Pigeonhole — minimal Microsoft Graph client.
 *
 * Only the calls the add-in needs: enumerate mail folders, sample recent
 * messages per folder (for training), move a message, mark it read, and
 * create an inbox rule. Uses $batch to keep training fast, and honors
 * Retry-After on throttling.
 */

/* global PigeonholeAuth */

var PigeonholeGraph = (function () {
  "use strict";

  var BASE = "https://graph.microsoft.com/v1.0";

  // Well-known folders that are never filing destinations.
  var EXCLUDED_FOLDERS = new Set([
    "inbox", "drafts", "sentitems", "deleteditems", "junkemail", "outbox",
    "conversationhistory", "syncissues", "conflicts", "localfailures",
    "serverfailures", "recoverableitemsdeletions", "scheduled", "clutter"
  ]);

  async function call(method, path, body, attempt) {
    attempt = attempt || 0;
    var token = await PigeonholeAuth.getToken();
    var res = await fetch(BASE + path, {
      method: method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 429 || res.status === 503) {
      if (attempt >= 4) throw new Error("Graph throttled repeatedly (" + res.status + ")");
      var wait = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
      await sleep(wait);
      return call(method, path, body, attempt + 1);
    }
    if (res.status === 204) return null;
    if (!res.ok) {
      var text = await res.text();
      throw new Error("Graph " + method + " " + path + " failed (" + res.status + "): " + text.slice(0, 300));
    }
    return res.json();
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /**
   * Enumerate the full mail folder tree (breadth-first, paged).
   * @returns {Promise<Array<{id, displayName, path, wellKnown, totalItemCount}>>}
   */
  async function listAllFolders(onProgress) {
    var wellKnown = await mapWellKnownFolders();
    var out = [];
    var queue = [{ path: "/me/mailFolders", prefix: "" }];

    while (queue.length) {
      var job = queue.shift();
      var url = job.path + "?$top=200&$select=id,displayName,childFolderCount,totalItemCount";
      while (url) {
        var page = await call("GET", url);
        (page.value || []).forEach(function (f) {
          var path = job.prefix ? job.prefix + " / " + f.displayName : f.displayName;
          out.push({
            id: f.id,
            displayName: f.displayName,
            path: path,
            wellKnown: wellKnown[f.id] || null,
            totalItemCount: f.totalItemCount || 0
          });
          if (f.childFolderCount > 0) {
            queue.push({ path: "/me/mailFolders/" + f.id + "/childFolders", prefix: path });
          }
        });
        url = page["@odata.nextLink"]
          ? page["@odata.nextLink"].replace(BASE, "")
          : null;
        if (onProgress) onProgress(out.length);
      }
    }
    return out;
  }

  /** Map folder id -> well-known name, so system folders can be excluded. */
  async function mapWellKnownFolders() {
    var names = Array.from(EXCLUDED_FOLDERS).concat(["archive"]);
    var map = {};
    var requests = names.map(function (n, i) {
      return { id: String(i), method: "GET", url: "/me/mailFolders/" + n + "?$select=id" };
    });
    var res = await batch(requests);
    res.forEach(function (r, i) {
      if (r && r.status === 200 && r.body && r.body.id) {
        map[r.body.id] = names[i];
      }
    });
    return map;
  }

  /** Folders a user actually files into (system folders removed). */
  function trainableFolders(folders) {
    return folders.filter(function (f) {
      if (f.wellKnown && EXCLUDED_FOLDERS.has(f.wellKnown)) return false;
      if (f.totalItemCount === 0) return false;
      return true;
    });
  }

  /**
   * Run JSON batch requests (Graph allows 20 per batch).
   * @returns array of responses aligned with `requests` order.
   */
  async function batch(requests) {
    var results = new Array(requests.length);
    for (var i = 0; i < requests.length; i += 20) {
      var chunk = requests.slice(i, i + 20).map(function (r, j) {
        return { id: String(i + j), method: r.method, url: r.url };
      });
      var res = await call("POST", "/$batch", { requests: chunk });
      (res.responses || []).forEach(function (r) {
        results[parseInt(r.id, 10)] = r;
      });
    }
    return results;
  }

  /**
   * Sample up to `perFolder` recent messages from each folder, batched.
   * @param {Array} folders trainable folder descriptors
   * @param {number} perFolder messages per folder
   * @param {function} onProgress (foldersDone, foldersTotal, messagesSoFar)
   * @returns {Promise<Array<{folderId, msg}>>}
   */
  async function sampleMessages(folders, perFolder, onProgress) {
    var select = "$select=subject,sender,toRecipients,ccRecipients";
    var samples = [];
    var done = 0;

    var requests = folders.map(function (f) {
      return {
        method: "GET",
        url: "/me/mailFolders/" + f.id + "/messages?$top=" + perFolder +
             "&" + select + "&$orderby=receivedDateTime desc"
      };
    });

    for (var i = 0; i < requests.length; i += 20) {
      var res = await batch(requests.slice(i, i + 20));
      res.forEach(function (r, j) {
        var folder = folders[i + j];
        done++;
        if (!r || r.status !== 200 || !r.body || !r.body.value) return;
        r.body.value.forEach(function (m) {
          samples.push({ folderId: folder.id, msg: toMsgDescriptor(m) });
        });
      });
      if (onProgress) onProgress(done, folders.length, samples.length);
    }
    return samples;
  }

  /** Normalize a Graph message resource into classifier input. */
  function toMsgDescriptor(m) {
    var sender = (m.sender && m.sender.emailAddress) || {};
    return {
      senderAddress: sender.address || "",
      senderName: sender.name || "",
      subject: m.subject || "",
      toAddresses: (m.toRecipients || []).map(addr),
      ccAddresses: (m.ccRecipients || []).map(addr)
    };
    function addr(r) { return (r.emailAddress && r.emailAddress.address) || ""; }
  }

  /** Mark a message read, then move it. Returns the moved message. */
  async function fileMessage(restMessageId, destinationFolderId) {
    await call("PATCH", "/me/messages/" + restMessageId, { isRead: true });
    return call("POST", "/me/messages/" + restMessageId + "/move", {
      destinationId: destinationFolderId
    });
  }

  /**
   * One-click Outlook rule: always move mail from `senderAddress`
   * to `folderId` (server-side, applies even when Outlook is closed).
   */
  async function createSenderRule(senderAddress, folderId, folderName) {
    var rules = await call("GET", "/me/mailFolders/inbox/messageRules?$top=100");
    var sequence = 1 + (rules.value || []).reduce(function (mx, r) {
      return Math.max(mx, r.sequence || 0);
    }, 0);

    return call("POST", "/me/mailFolders/inbox/messageRules", {
      displayName: "Pigeonhole: " + senderAddress + " → " + folderName,
      sequence: sequence,
      isEnabled: true,
      conditions: {
        senderContains: [senderAddress]
      },
      actions: {
        moveToFolder: folderId,
        markAsRead: true,
        stopProcessingRules: true
      }
    });
  }

  return {
    listAllFolders: listAllFolders,
    trainableFolders: trainableFolders,
    sampleMessages: sampleMessages,
    toMsgDescriptor: toMsgDescriptor,
    fileMessage: fileMessage,
    createSenderRule: createSenderRule
  };
})();
