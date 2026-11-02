import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const Landing = lazy(() => import("./Landing.jsx"));
const AppPages = lazy(() => import("./AppPages.jsx"));
const OceanApp = lazy(() => import("./OceanApp.jsx"));

function RouteLoader() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const isOcean = location.hostname === "app.taallab.work";
  const Page = isOcean ? OceanApp : path === "/" ? Landing : AppPages;
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
      <Page />
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(<RouteLoader />);
