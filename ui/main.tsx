import "@fontsource-variable/dm-sans";

import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./settings/settings.css";
import "./editor/editor.css";

createRoot(document.getElementById("root")!).render(<App/>);
