import "@fontsource-variable/dm-sans";

import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./settings/settings.css";
import "./editor/editor.css";

// A desktop app has no browser menu: right-click does nothing unless a control handles it.
document.addEventListener("contextmenu", event => event.preventDefault());

createRoot(document.getElementById("root")!).render(<App/>);
