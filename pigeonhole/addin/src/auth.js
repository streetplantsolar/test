/**
 * Pigeonhole — Microsoft Graph authentication.
 *
 * Uses MSAL.js with Nested App Authentication (NAA), the current
 * Microsoft-recommended approach for Outlook add-ins. NAA works entirely
 * client-side (no token-exchange backend), in classic Outlook desktop,
 * new Outlook, and Outlook on the web. Where NAA is unavailable the code
 * falls back to a standard MSAL popup flow.
 *
 * Configuration: set CLIENT_ID to your Azure App Registration's
 * application ID (see docs/SETUP.md). The registration needs the SPA
 * redirect URI `brk-multihub://<your-addin-domain>` for NAA plus your
 * taskpane URL for the popup fallback, and delegated Graph permissions:
 *   Mail.ReadWrite, MailboxSettings.ReadWrite, User.Read
 */

/* global msal, Office */

var PigeonholeAuth = (function () {
  "use strict";

  // TODO(deploy): replace with your Azure App Registration client id.
  var CLIENT_ID = "00000000-0000-0000-0000-000000000000";

  var SCOPES = [
    "https://graph.microsoft.com/Mail.ReadWrite",
    "https://graph.microsoft.com/MailboxSettings.ReadWrite",
    "https://graph.microsoft.com/User.Read"
  ];

  var pca = null;        // PublicClientApplication (nested or standard)
  var usingNAA = false;

  function msalConfig() {
    return {
      auth: {
        clientId: CLIENT_ID,
        authority: "https://login.microsoftonline.com/common"
      },
      cache: { cacheLocation: "localStorage" }
    };
  }

  /** Initialize MSAL, preferring Nested App Authentication. */
  async function init() {
    if (pca) return;
    try {
      pca = await msal.createNestablePublicClientApplication(msalConfig());
      usingNAA = true;
    } catch (e) {
      pca = new msal.PublicClientApplication(msalConfig());
      await pca.initialize();
      usingNAA = false;
    }
  }

  /**
   * Get a Graph access token, silently when possible.
   * @returns {Promise<string>}
   */
  async function getToken() {
    await init();
    var account = pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
    var request = { scopes: SCOPES, account: account };

    try {
      var silent = await pca.acquireTokenSilent(request);
      pca.setActiveAccount(silent.account);
      return silent.accessToken;
    } catch (silentErr) {
      var popup = await pca.acquireTokenPopup(request);
      pca.setActiveAccount(popup.account);
      return popup.accessToken;
    }
  }

  /** True once a cached account exists (i.e. user has signed in before). */
  function hasAccount() {
    return !!(pca && (pca.getActiveAccount() || pca.getAllAccounts()[0]));
  }

  function signOut() {
    if (!pca) return Promise.resolve();
    var account = pca.getActiveAccount() || pca.getAllAccounts()[0];
    if (!account) return Promise.resolve();
    // clearCache avoids a full-page logout redirect inside the taskpane.
    return pca.clearCache({ account: account });
  }

  return {
    init: init,
    getToken: getToken,
    hasAccount: hasAccount,
    signOut: signOut,
    isNested: function () { return usingNAA; }
  };
})();
