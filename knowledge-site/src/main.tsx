import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BookSite } from "../app/BookSite";
import { OpticalLab, opticalLabPage } from "../app/optics/OpticalLab";
import "../app/globals.css";

const labPage = opticalLabPage(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {labPage ? <OpticalLab page={labPage} /> : <BookSite />}
  </StrictMode>,
);
