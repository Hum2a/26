import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { installTheme } from "./theme/install";
import { installErrorReporter } from "./device/error-reporter";
import "./index.css";

installTheme();
installErrorReporter();

const root = document.querySelector("#root");

if (!root) {
  throw new Error("The page is missing its root element.");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
