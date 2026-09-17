import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BookSite } from "../app/BookSite";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookSite />
  </StrictMode>,
);
