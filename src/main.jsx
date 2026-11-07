import React, { lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const Landing = lazy(() => import("./Landing.jsx"));
const AppPages = lazy(() => import("./AppPages.jsx"));
const OceanApp = lazy(() => import("./OceanApp.jsx"));

function RouteLoader() {
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
