(() => {
  "use strict";
  const COOKIE = "taallab_privacy_consent";
  const MAX_AGE = 60 * 60 * 24 * 180;
  const readChoice = () => {
    const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
    let value = match ? decodeURIComponent(match[1]) : "";
    if (!value) {
      try { value = localStorage.getItem(COOKIE) || ""; } catch {}
    }
    if (!value) return null;
    if (value === "v1.essential") return { essential: true, externalResources: false, analytics: false, marketing: false };
    if (value === "v1.optional") return { essential: true, externalResources: true, analytics: false, marketing: false };
    return null;
  };
  const writeChoice = (externalResources) => {
    const value = externalResources ? "v1.optional" : "v1.essential";
    let cookie = COOKIE + "=" + encodeURIComponent(value) + "; Max-Age=" + MAX_AGE + "; Path=/; SameSite=Lax";
    if (location.protocol === "https:") cookie += "; Secure";
    if (location.hostname === "taallab.in" || location.hostname.endsWith(".taallab.in")) cookie += "; Domain=.taallab.in";
    document.cookie = cookie;
    try { localStorage.setItem(COOKIE, value); } catch {}
  };
  const loadOptionalResources = () => {
    if (document.querySelector("[data-taal-optional-fonts]")) return;
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.googleapis.com";
    preconnect.dataset.taalOptionalFonts = "true";
    document.head.appendChild(preconnect);
    const staticConnect = document.createElement("link");
    staticConnect.rel = "preconnect";
    staticConnect.href = "https://fonts.gstatic.com";
    staticConnect.crossOrigin = "anonymous";
    staticConnect.dataset.taalOptionalFonts = "true";
    document.head.appendChild(staticConnect);
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto:wght@300;400;500;700;900&family=Space+Grotesk:wght@500;600;700&display=swap";
    fonts.dataset.taalOptionalFonts = "true";
    document.head.appendChild(fonts);
  };
  const getChoice = () => readChoice() || { essential: true, externalResources: false, analytics: false, marketing: false };
  window.taalLabPrivacyConsent = {
    get: getChoice,
    allows(category) {
      const choice = getChoice();
      if (category === "essential") return true;
      if (category === "external_resources") return !!choice.externalResources;
      if (category === "analytics") return !!choice.analytics;
      if (category === "marketing") return !!choice.marketing;
      return false;
    }
  };
  const announce = (choice) => window.dispatchEvent(new CustomEvent("taallab:consent-changed", { detail: choice }));
  const existing = readChoice();
  if (existing?.externalResources) loadOptionalResources();

  const style = document.createElement("style");
  style.textContent = `
    #taal-privacy-banner{position:fixed;z-index:100000;left:16px;right:16px;bottom:54px;max-width:760px;margin:0 auto;padding:17px 19px;background:#171a20;color:#f5f7fa;border:1px solid #454b55;border-radius:15px;box-shadow:0 14px 50px rgba(0,0,0,.28);font:14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:space-between;gap:18px}
    #taal-privacy-banner[hidden]{display:none}
    #taal-privacy-banner .taal-copy{min-width:0;flex:1}
    #taal-privacy-banner strong{display:block;font-size:14px}
    #taal-privacy-banner p{margin:5px 0 0;color:#d1d6dd;font-size:12px;line-height:1.55}
    #taal-privacy-banner a{color:#a9d1ff;text-decoration:underline;text-underline-offset:3px}
    #taal-privacy-banner .taal-actions{display:flex;flex-wrap:wrap;gap:8px;flex:none}
    #taal-privacy-banner button,#taal-cookie-settings{font:600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;border-radius:9px;padding:10px 13px}
    #taal-privacy-banner button{border:1px solid #8993a0;background:transparent;color:#f5f7fa}
    #taal-privacy-banner button.primary{background:#f5f7fa;color:#171a20;border-color:#f5f7fa}
    #taal-cookie-settings{position:fixed;z-index:99999;left:14px;bottom:12px;border:1px solid #8993a0;background:#171a20;color:#f5f7fa;box-shadow:0 3px 14px rgba(0,0,0,.18)}
    #taal-privacy-banner button:focus-visible,#taal-cookie-settings:focus-visible,:where(a,button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #0068cc;outline-offset:3px}
    @media(max-width:620px){#taal-privacy-banner{left:10px;right:10px;bottom:58px;align-items:stretch;flex-direction:column;gap:12px;padding:15px}#taal-privacy-banner .taal-actions{display:grid;grid-template-columns:1fr 1fr}#taal-privacy-banner button{min-height:42px}#taal-cookie-settings{left:10px;bottom:10px}}
  `;
  document.head.appendChild(style);

  const banner = document.createElement("section");
  banner.id = "taal-privacy-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Cookie and privacy preferences");
  banner.setAttribute("aria-live", "polite");
  banner.hidden = !!existing;
  banner.innerHTML = '<div class="taal-copy"><strong>Privacy and cookie choices</strong><p>Essential storage keeps sign-in, adult confirmation for public shares and your shopping cart working. We do not currently use advertising or analytics trackers. Optional Google Fonts are requested only if you choose to allow them. <a href="/privacy.html">Privacy Policy</a></p></div><div class="taal-actions"><button type="button" data-choice="essential">Essential only</button><button type="button" class="primary" data-choice="optional">Allow optional fonts</button></div>';
  document.body.appendChild(banner);

  const settings = document.createElement("button");
  settings.id = "taal-cookie-settings";
  settings.type = "button";
  settings.textContent = "Cookie settings";
  settings.setAttribute("aria-label", "Open cookie and privacy settings");
  document.body.appendChild(settings);

  const choose = (optional) => {
    writeChoice(optional);
    const choice = getChoice();
    banner.hidden = true;
    if (optional) loadOptionalResources();
    else document.querySelectorAll("[data-taal-optional-fonts]").forEach((node) => node.remove());
    announce(choice);
  };
  banner.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-choice]");
    if (button) choose(button.dataset.choice === "optional");
  });
  settings.addEventListener("click", () => {
    banner.hidden = false;
    banner.querySelector('button[data-choice="essential"]').focus();
  });
  if (existing) announce(existing);
})();