/**
 * Pigeonhole — local persistence.
 *
 * Everything lives in localStorage, keyed per mailbox, on this machine
 * only. No sync, no server, no telemetry. Clearing browser/add-in storage
 * removes the model entirely.
 */

var PigeonholeStore = (function () {
  "use strict";

  var PREFIX = "pigeonhole.";
  var mailboxKey = "default";

  function setMailbox(smtpAddress) {
    mailboxKey = (smtpAddress || "default").toLowerCase();
  }

  function k(name) {
    return PREFIX + mailboxKey + "." + name;
  }

  function getJSON(name, fallback) {
    try {
      var raw = localStorage.getItem(k(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setJSON(name, value) {
    localStorage.setItem(k(name), JSON.stringify(value));
  }

  function remove(name) {
    localStorage.removeItem(k(name));
  }

  return {
    setMailbox: setMailbox,

    getModel: function () { return getJSON("model", null); },
    setModel: function (m) { setJSON("model", m); },
    clearModel: function () { remove("model"); },

    getSettings: function () {
      return getJSON("settings", { perFolder: 50, autoLearn: true });
    },
    setSettings: function (s) { setJSON("settings", s); },

    // License/trial state is intentionally also local-only.
    getLicense: function () { return getJSON("license", null); },
    setLicense: function (l) { setJSON("license", l); },

    getTrialStart: function () {
      var t = getJSON("trialStart", null);
      if (!t) {
        t = new Date().toISOString();
        setJSON("trialStart", t);
      }
      return t;
    }
  };
})();
