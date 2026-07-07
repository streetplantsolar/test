/**
 * Pigeonhole — trial & license handling.
 *
 * 7-day free trial that starts on first launch, then a $30/year license.
 * Keys are validated offline so the add-in never phones home; the key
 * itself encodes an expiry date and a checksum.
 *
 * Key format:  PGNH-<BASE32 PAYLOAD>-<CHECK>
 *   payload = email-hash (6 chars) + expiry (YYYYMMDD)
 *   check   = FNV-1a hash of payload with the vendor secret, base32, 6 chars
 *
 * NOTE(deploy): offline checks deter casual sharing, not determined
 * attackers — that's the right trade-off for a $30 tool. Generate keys
 * at purchase time with scripts/make-license-key.js from your payment
 * provider's webhook (Stripe/Paddle/Lemon Squeezy), using the same
 * VENDOR_SECRET. Change VENDOR_SECRET before shipping.
 */

var PigeonholeLicense = (function () {
  "use strict";

  var TRIAL_DAYS = 7;
  var VENDOR_SECRET = "change-me-before-shipping"; // must match key generator
  var B32 = "ABCDEFGHJKMNPQRSTVWXYZ0123456789"; // no I/L/O/U — unambiguous

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function toB32(num, len) {
    var s = "";
    while (s.length < len) {
      s = B32[num % 32] + s;
      num = Math.floor(num / 32);
    }
    return s;
  }

  /** Parse and verify a key. Returns {valid, expires, reason}. */
  function verifyKey(key, email) {
    var norm = (key || "").toUpperCase().replace(/\s/g, "");
    var m = norm.match(/^PGNH-([A-Z0-9]{6})(\d{8})-([A-Z0-9]{6})$/);
    if (!m) return { valid: false, reason: "That doesn't look like a Pigeonhole key." };

    var emailHash = m[1];
    var expiry = m[2];
    var check = m[3];

    var payload = emailHash + expiry;
    var expected = toB32(fnv1a(payload + "|" + VENDOR_SECRET), 6);
    if (check !== expected) {
      return { valid: false, reason: "Key checksum doesn't match. Check for typos." };
    }

    if (email) {
      var eh = toB32(fnv1a(email.toLowerCase().trim()), 6);
      if (eh !== emailHash) {
        return { valid: false, reason: "This key was issued for a different email address." };
      }
    }

    var expires = new Date(
      +expiry.slice(0, 4), +expiry.slice(4, 6) - 1, +expiry.slice(6, 8), 23, 59, 59
    );
    if (expires < new Date()) {
      return { valid: false, reason: "This key expired on " + expires.toLocaleDateString() + "." };
    }
    return { valid: true, expires: expires.toISOString() };
  }

  /**
   * Current entitlement.
   * @returns {{state:'licensed'|'trial'|'expired', daysLeft:number, detail:string}}
   */
  function status(store, email) {
    var lic = store.getLicense();
    if (lic && lic.key) {
      var v = verifyKey(lic.key, email);
      if (v.valid) {
        var days = Math.ceil((new Date(v.expires) - new Date()) / 86400000);
        return { state: "licensed", daysLeft: days, detail: "Licensed" };
      }
    }
    var start = new Date(store.getTrialStart());
    var elapsed = (new Date() - start) / 86400000;
    var left = Math.ceil(TRIAL_DAYS - elapsed);
    if (left > 0) {
      return { state: "trial", daysLeft: left, detail: "Free trial — " + left + " day" + (left === 1 ? "" : "s") + " left" };
    }
    return { state: "expired", daysLeft: 0, detail: "Trial ended" };
  }

  function activate(store, key, email) {
    var v = verifyKey(key, email);
    if (v.valid) store.setLicense({ key: key.trim(), activatedAt: new Date().toISOString() });
    return v;
  }

  return { verifyKey: verifyKey, status: status, activate: activate, TRIAL_DAYS: TRIAL_DAYS };
})();
