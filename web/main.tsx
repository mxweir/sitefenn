import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource-variable/dm-sans/wght.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
