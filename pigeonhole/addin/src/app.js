/**
 * Pigeonhole — taskpane orchestration.
 *
 * Wires Office.js (current item, item-changed events) to the local
 * classifier and the Graph client. All state transitions flow through
 * showView(); the pane is pinnable, so it re-ranks whenever the user
 * selects a different message.
 */

/* global Office, PigeonholeClassifier, PigeonholeStore, PigeonholeLicense,
          PigeonholeAuth, PigeonholeGraph */

(function () {
  "use strict";

  var SUGGEST_PRIMARY = 5;   // top suggestions shown immediately
  var SUGGEST_OTHER = 5;     // "Other folders" reveals ranks 6-10

  var model = null;
  var currentMsg = null;     // classifier descriptor of the selected item
  var userEmail = "";

  var $ = function (id) { return document.getElementById(id); };

  Office.onReady(function (info) {
    if (info.host !== Office.HostType.Outlook) return;

    userEmail = (Office.context.mailbox.userProfile.emailAddress || "").toLowerCase();
    PigeonholeStore.setMailbox(userEmail);
    model = PigeonholeStore.getModel();

    wireEvents();
    renderLicenseChip();

    Office.context.mailbox.addHandlerAsync(
      Office.EventType.ItemChanged,
      function () { onItemChanged(); }
    );

    route();
  });

  // ------------------------------------------------------------ routing

  function route() {
    var lic = PigeonholeLicense.status(PigeonholeStore, userEmail);
    if (lic.state === "expired") { showView("expired"); return; }
    if (!model) { showView("train"); return; }
    onItemChanged();
  }

  function showView(name) {
    ["signin", "train", "progress", "suggest", "expired"].forEach(function (v) {
      $("view-" + v).hidden = v !== name;
    });
    $("btn-retrain").hidden = !(name === "suggest" && model);
    renderModelStat();
  }

  // ------------------------------------------------------------ events

  function wireEvents() {
    $("btn-signin").addEventListener("click", function () {
      PigeonholeAuth.getToken().then(route).catch(showAuthError);
    });
    $("btn-train").addEventListener("click", trainNow);
    $("btn-retrain").addEventListener("click", trainNow);
    $("btn-other").addEventListener("click", function () {
      var other = $("suggestions-other");
      other.hidden = !other.hidden;
      $("btn-other").querySelector(".ph-other-caret").textContent =
        other.hidden ? "▾" : "▴";
    });
    $("btn-activate").addEventListener("click", activateLicense);
    $("btn-enter-license").addEventListener("click", function () { showView("expired"); });
  }

  function showAuthError(err) {
    banner("Sign-in failed: " + (err && err.message ? err.message : err), true);
  }

  // ------------------------------------------------------------ training

  async function trainNow() {
    showView("progress");
    setProgress(0, "Signing in…");

    try {
      await PigeonholeAuth.getToken();

      setProgress(5, "Mapping your folder tree…");
      var folders = await PigeonholeGraph.listAllFolders(function (n) {
        setProgress(Math.min(5 + n / 20, 20), "Found " + n + " folders…");
      });

      var trainable = PigeonholeGraph.trainableFolders(folders);
      if (!trainable.length) {
        showView("train");
        banner("No filing folders found — file a few emails manually first, then train.", true);
        return;
      }

      var settings = PigeonholeStore.getSettings();
      setProgress(22, "Sampling messages from " + trainable.length + " folders…");
      var samples = await PigeonholeGraph.sampleMessages(
        trainable,
        settings.perFolder,
        function (done, total, msgs) {
          setProgress(22 + (done / total) * 70,
            done + "/" + total + " folders · " + msgs + " messages");
        }
      );

      setProgress(94, "Building the model…");
      var meta = {};
      trainable.forEach(function (f) {
        meta[f.id] = { displayName: f.displayName, path: f.path };
      });
      model = PigeonholeClassifier.train(samples, meta);
      PigeonholeStore.setModel(model);

      setProgress(100, "Done — trained on " + model.totalDocs + " messages.");
      setTimeout(function () { route(); }, 500);
    } catch (err) {
      showView(model ? "suggest" : "train");
      banner("Training failed: " + (err && err.message ? err.message : err), true);
    }
  }

  function setProgress(pct, detail) {
    $("progress-fill").style.width = pct + "%";
    $("progress-detail").textContent = detail || "";
  }

  // ------------------------------------------------------------ suggestions

  function onItemChanged() {
    if (!model) { route(); return; }
    var item = Office.context.mailbox.item;
    if (!item || item.itemType !== Office.MailboxEnums.ItemType.Message) {
      currentMsg = null;
      showView("suggest");
      $("current-subject").textContent = "Select an email to file it.";
      $("current-sender").textContent = "";
      $("suggestions").innerHTML = "";
      $("btn-other").hidden = true;
      $("suggestions-other").hidden = true;
      return;
    }

    currentMsg = {
      itemId: item.itemId,
      senderAddress: item.from ? item.from.emailAddress : "",
      senderName: item.from ? item.from.displayName : "",
      subject: item.subject || "",
      toAddresses: (item.to || []).map(function (r) { return r.emailAddress; }),
      ccAddresses: (item.cc || []).map(function (r) { return r.emailAddress; })
    };

    showView("suggest");
    $("filed-banner").hidden = true;
    $("current-subject").textContent = currentMsg.subject || "(no subject)";
    $("current-sender").textContent = currentMsg.senderName
      ? currentMsg.senderName + " · " + currentMsg.senderAddress
      : currentMsg.senderAddress;

    var ranked = PigeonholeClassifier.rank(model, currentMsg);
    renderSuggestions(ranked);
  }

  function renderSuggestions(ranked) {
    var primary = ranked.slice(0, SUGGEST_PRIMARY);
    var other = ranked.slice(SUGGEST_PRIMARY, SUGGEST_PRIMARY + SUGGEST_OTHER);

    fillList($("suggestions"), primary, 1);
    fillList($("suggestions-other"), other, SUGGEST_PRIMARY + 1);

    $("btn-other").hidden = other.length === 0;
    $("suggestions-other").hidden = true;
    $("btn-other").querySelector(".ph-other-caret").textContent = "▾";
  }

  function fillList(listEl, items, rankStart) {
    listEl.innerHTML = "";
    var tpl = $("tpl-suggestion");
    items.forEach(function (s, i) {
      var node = tpl.content.cloneNode(true);
      var li = node.querySelector(".ph-suggestion");
      if (rankStart + i === 1) li.classList.add("top");
      node.querySelector(".ph-folder-rank").textContent = rankStart + i;
      node.querySelector(".ph-folder-name").textContent = s.displayName;
      node.querySelector(".ph-folder-path").textContent = s.path;
      node.querySelector(".ph-confidence-fill").style.width =
        Math.max(6, Math.round(s.confidence * 100)) + "%";
      node.querySelector(".ph-folder-btn").addEventListener("click", function () {
        fileTo(s);
      });
      node.querySelector(".ph-rule-btn").addEventListener("click", function (ev) {
        ev.stopPropagation();
        createRule(s);
      });
      listEl.appendChild(node);
    });
  }

  // ------------------------------------------------------------ actions

  async function fileTo(suggestion) {
    if (!currentMsg || !currentMsg.itemId) return;
    var msg = currentMsg;
    banner("Filing to " + suggestion.displayName + "…");

    try {
      var restId = Office.context.mailbox.convertToRestId(
        msg.itemId, Office.MailboxEnums.RestVersion.v2_0
      );
      await PigeonholeGraph.fileMessage(restId, suggestion.folderId);

      // Reinforce the model with the confirmed decision.
      if (PigeonholeStore.getSettings().autoLearn) {
        model = PigeonholeClassifier.learnOne(model, suggestion.folderId, msg);
        PigeonholeStore.setModel(model);
      }
      banner("Moved to " + suggestion.path + " ✓");
    } catch (err) {
      banner("Couldn't move it: " + (err && err.message ? err.message : err), true);
    }
  }

  async function createRule(suggestion) {
    if (!currentMsg || !currentMsg.senderAddress) return;
    var sender = currentMsg.senderAddress;
    banner("Creating rule for " + sender + "…");
    try {
      await PigeonholeGraph.createSenderRule(
        sender, suggestion.folderId, suggestion.displayName
      );
      banner("Rule created: mail from " + sender + " now auto-files to " +
        suggestion.displayName + " ✓");
    } catch (err) {
      banner("Couldn't create the rule: " + (err && err.message ? err.message : err), true);
    }
  }

  // ------------------------------------------------------------ license

  function renderLicenseChip() {
    var chip = $("license-chip");
    var lic = PigeonholeLicense.status(PigeonholeStore, userEmail);
    chip.hidden = false;
    chip.textContent = lic.detail;
    chip.className = "ph-chip" +
      (lic.state === "expired" ? " bad" : lic.state === "trial" ? " warn" : "");
    $("btn-enter-license").hidden = lic.state === "licensed";
  }

  function activateLicense() {
    var key = $("license-input").value;
    var res = PigeonholeLicense.activate(PigeonholeStore, key, userEmail);
    if (res.valid) {
      $("activate-error").hidden = true;
      renderLicenseChip();
      route();
    } else {
      $("activate-error").hidden = false;
      $("activate-error").textContent = res.reason;
    }
  }

  // ------------------------------------------------------------ misc

  function renderModelStat() {
    var el = $("model-stat");
    el.textContent = model
      ? model.totalDocs + " messages · " +
        Object.keys(model.docCount).length + " folders · trained " +
        new Date(model.trainedAt).toLocaleDateString()
      : "Not trained yet";
  }

  function banner(text, isError) {
    var el = $("filed-banner");
    el.hidden = false;
    el.textContent = text;
    el.className = "ph-banner" + (isError ? " error" : "");
  }
})();
