import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LathTracker } from "./components/lath-tracker";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LathTracker />
  </StrictMode>,
);
