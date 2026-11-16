import { invoke } from "@tauri-apps/api/core";

export async function encode(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
}

export function decode(bytes: string) {
  return Uint8Array.from(atob(bytes), c => c.charCodeAt(0));
}

export async function exportFile(name: string, bytes: Blob) {
  await invoke<boolean>("save_export", { name, data: await encode(bytes) });
}

export function safeName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120) || "Untitled";
}
