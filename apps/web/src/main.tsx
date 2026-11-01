import { StrictMode } from "react";
import { MotionConfig } from "motion/react";
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
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
    >
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
);
