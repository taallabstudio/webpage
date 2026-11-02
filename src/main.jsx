import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const Landing = lazy(() => import("./Landing.jsx"));
const AppPages = lazy(() => import("./AppPages.jsx"));

function RouteLoader() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const Page = path === "/" ? Landing : AppPages;
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
      <Page />
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(<RouteLoader />);
