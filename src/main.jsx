import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const Landing = lazy(() => import("./Landing.jsx"));
const AppPages = lazy(() => import("./AppPages.jsx"));
const OceanApp = lazy(() => import("./OceanApp.jsx"));

async function handleOceanOAuthUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return; }
  if (url.protocol !== "ocean:" || url.hostname !== "oauth" || url.pathname !== "/callback") return;
  const params = url.searchParams;
  if (params.get("google_2fa") === "1") {
    const query = new URLSearchParams({ google_2fa: "1", challenge_id: params.get("challenge_id") || "", email: params.get("email") || "", method: params.get("method") || "email" });
    window.location.replace("/ocean.html?" + query.toString());
    return;
  }
  const code = params.get("code");
  if (!code) {
    window.location.replace("/ocean.html?" + new URLSearchParams({ google_error: params.get("error") || "Google sign-in could not be completed. Please try again." }).toString());
    return;
  }
  try {
    const response = await fetch("/api/auth/google/exchange", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Google sign-in could not be completed.");
    window.location.replace("/ocean.html?google_signed_in=1");
  } catch (error) {
    window.location.replace("/ocean.html?" + new URLSearchParams({ google_error: error?.message || "Google sign-in could not be completed. Please try again." }).toString());
  }
}


function EssentialStorageNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(localStorage.getItem("taallab.essential-storage-notice.v1") !== "dismissed"); }
    catch { setVisible(true); }
  }, []);
  if (!visible) return null;
  return <aside role="region" aria-label="Cookie and storage notice" style={{position:"fixed",zIndex:10000,left:16,right:16,bottom:16,maxWidth:760,margin:"0 auto",padding:"16px 18px",background:"#fff",color:"#1d2229",border:"1px solid #dce2e8",borderRadius:14,boxShadow:"0 12px 40px rgba(0,0,0,.18)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
    <p style={{margin:0,flex:"1 1 420px",fontSize:13,lineHeight:1.55}}>TAAL LAB uses essential session storage to keep you signed in and local storage to remember your shop cart. <a href="/privacy.html" style={{color:"#075fb8"}}>Privacy Policy</a></p>
    <button type="button" onClick={()=>{try{localStorage.setItem("taallab.essential-storage-notice.v1","dismissed")}catch{}setVisible(false)}} style={{border:0,borderRadius:9,padding:"10px 16px",background:"#0878e8",color:"#fff",fontWeight:700,cursor:"pointer"}}>Got it</button>
  </aside>;
}

function RouteLoader() {
  useEffect(() => {
    let active = true;
    let unlisten = null;
    const receive = (urls) => { for (const url of urls || []) void handleOceanOAuthUrl(url); };
    getCurrent().then((urls) => { if (active && urls) receive(urls); }).catch(() => {});
    onOpenUrl(receive).then((stop) => { if (active) unlisten = stop; else stop(); }).catch(() => {});
    return () => { active = false; unlisten?.(); };
  }, []);
  useEffect(() => {
    const timers = new WeakMap();
    const handleButtonClick = (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button) return;
      button.classList.remove("button-click-feedback");
      void button.offsetWidth;
      button.classList.add("button-click-feedback");
      const previous = timers.get(button);
      if (previous) clearTimeout(previous);
      timers.set(button, setTimeout(() => {
        button.classList.remove("button-click-feedback");
        timers.delete(button);
      }, 1000));
    };
    document.addEventListener("click", handleButtonClick, true);
    return () => document.removeEventListener("click", handleButtonClick, true);
  }, []);
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const isOcean = location.hostname === "ocean.taallab.in";
  const Page = isOcean ? OceanApp : path === "/" ? Landing : AppPages;
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
      <Page />
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(<RouteLoader />);
