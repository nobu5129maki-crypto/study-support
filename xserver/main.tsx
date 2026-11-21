import { createRoot } from "react-dom/client";
import { XserverApp } from "../src/xserver/XserverApp";
import "../src/app/globals.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root がありません");
}
createRoot(root).render(<XserverApp />);
