import React from "react";
import { createRoot } from "react-dom/client";

import GanttRoot from '../gantt/gantt'

//import { App } from "./App";

import './index.css'

createRoot(document.getElementById("root") as Element).render(
  <React.StrictMode>
    {/*<App />*/}
    <GanttRoot />
  </React.StrictMode>,
);
