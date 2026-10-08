import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BookSite } from "../app/BookSite";
import { StorageTransfer } from "../app/StorageTransfer";
import "../app/globals.css";

const migration = window.location.pathname.startsWith("/optics/migrate");
if (!migration && /^\/(?:optics|training\/optical-bench|design\/optical-bench)(?:\/|$)/.test(window.location.pathname)) window.location.replace(`https://optical-lab-feiyang.pages.dev/${window.location.pathname.includes("design") ? "designer/" : ""}${window.location.hash}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {migration ? <StorageTransfer mode="export" /> : <BookSite />}
  </StrictMode>,
);
