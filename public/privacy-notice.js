(() => {
  "use strict";
  const storageKey = "taallab.privacy-notice.v2";
  try {
    if (window.localStorage.getItem(storageKey) === "dismissed") return;
  } catch {}

  const notice = document.createElement("aside");
  notice.id = "taallab-privacy-notice";
  notice.setAttribute("role", "region");
  notice.setAttribute("aria-label", "Privacy and storage notice");
  notice.style.cssText = [
    "position:fixed", "z-index:10000", "left:16px", "right:16px", "bottom:16px",
    "width:min(760px,calc(100% - 32px))", "margin:0 auto", "padding:16px 18px",
    "display:flex", "align-items:center", "gap:16px", "flex-wrap:wrap",
    "background:#fff", "color:#1d2229", "border:1px solid #cbd4de",
    "border-radius:14px", "box-shadow:0 12px 40px rgba(0,0,0,.18)",
    "font:13px/1.6 system-ui,-apple-system,Segoe UI,sans-serif"
  ].join(";");

  const copy = document.createElement("p");
  copy.style.cssText = "margin:0;flex:1 1 420px";
  copy.append("TAAL LAB uses essential session cookies for sign-in and local storage for your shop cart. We do not currently load advertising or analytics trackers. Google Fonts may be requested to display the site; payment and Google sign-in services connect when you choose to use them. ");

  const link = document.createElement("a");
  link.href = "/privacy.html";
  link.textContent = "Privacy Policy";
  link.style.cssText = "color:#075fb8;text-decoration:underline;text-underline-offset:3px";
  copy.append(link);

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Got it";
  dismiss.style.cssText = "flex:none;border:0;border-radius:9px;padding:10px 16px;background:#0878e8;color:#fff;font-weight:700;cursor:pointer";
  dismiss.addEventListener("click", () => {
    try { window.localStorage.setItem(storageKey, "dismissed"); } catch {}
    notice.remove();
  });
  dismiss.addEventListener("keydown", event => {
    if (event.key === "Escape") dismiss.click();
  });

  const responsive = document.createElement("style");
  responsive.textContent = ":where(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #075fb8;outline-offset:3px}#taallab-privacy-notice button:focus-visible{outline:3px solid #064f9e;outline-offset:3px}@media(max-width:560px){#taallab-privacy-notice{left:12px;right:12px;bottom:12px;width:auto;align-items:flex-start;flex-direction:column}#taallab-privacy-notice button{width:100%}}";
  document.head.append(responsive);
  notice.append(copy, dismiss);
  (document.body || document.documentElement).append(notice);
})();