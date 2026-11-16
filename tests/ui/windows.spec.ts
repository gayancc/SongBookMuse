import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let child: ChildProcess;
let data: string;
let browser: Browser;
let page: Page;

test.skip(process.platform !== "win32", "This suite drives the Windows WebView2 binary.");
test.beforeAll(async () => {
  const binary = resolve("target/debug/songbook-muse.exe");
  if (!existsSync(binary)) throw new Error("Build the debug binary with npm run tauri -- build --debug --no-bundle");
  data = mkdtempSync(join(tmpdir(), "muse-ui-"));
  const port = 19220;
  child = spawn(binary, [], {
    windowsHide: true,
    env: {
      ...process.env,
      MUSE_TEST_DATA_DIR: join(data, "library"),
      WEBVIEW2_USER_DATA_FOLDER: join(data, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=" + port,
    }
  });
  const endpoint = "http://127.0.0.1:" + port;
  await expect.poll(async () => {
    const response = await fetch(endpoint + "/json/list").catch(() => null);
    const pages = response?.ok ? await response.json() : [];
    return pages.some((target: { url: string }) => target.url.includes("tauri.localhost"));
  }, { timeout: 25000 }).toBe(true);
  browser = await chromium.connectOverCDP(endpoint);
  page = browser.contexts()[0].pages().find(p => p.url().includes("tauri.localhost"))!;
  await expect(page.getByRole("complementary", { name: "Library browser" })).toBeVisible();
});

const hint = () => page.locator("footer.hintbar");
const lcd = () => page.getByRole("status", { name: "Song display" });
test.afterAll(async () => {
  if (page && child?.pid && child.exitCode === null) {
    const closed = new Promise(resolve => child.once("close", resolve));
    await page.evaluate(() => {
      const { __TAURI_INTERNALS__: api } = window as unknown as {
        __TAURI_INTERNALS__: { invoke(command: string, args: object): Promise<unknown> };
      };
      return api.invoke("plugin:window|close", { label: "main" });
    }).catch(() => {});
    await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 5000))]);
  }
  await browser?.close().catch(() => {});
  if (child?.pid && child.exitCode === null) {
    const closed = new Promise(resolve => child.once("close", resolve));
    child.kill();
    await closed;
  }
  if (data) {
    try { rmSync(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (error) { console.warn("WebView2 is still releasing its isolated test profile", data, error); }
  }
});

test("creates, transposes, setlists and reopens a song across three viewport sizes", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Soundcheck");
  await page.getByLabel("Artist", { exact: true }).fill("The House Trio");
  await page.getByLabel("Key", { exact: true }).fill("Am");
  await page.getByLabel("Source", { exact: true }).fill("{soc}\n[Am]Count in [F]together\n{eoc}");
  await expect(page.getByRole("region", { name: "Live preview" }).getByText("Count in", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save song" }).click();
  await expect(page.getByRole("heading", { name: "Soundcheck", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Song details" }).click();
  await page.getByRole("button", { name: "Transpose up" }).click();
  await expect(lcd()).toContainText("Bbm");
  await expect(page.locator(".fit-page .chart-part strong").first()).toHaveText("Bbm");
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/desktop.png" });
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  await page.getByRole("button", { name: "New setlist" }).click();
  await page.getByLabel("Name", { exact: true }).fill("First rehearsal");
  await page.getByRole("button", { name: "Save setlist" }).click();
  await page.getByRole("button", { name: "Song actions" }).click();
  await page.getByRole("menuitem", { name: "Add to setlist" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "First rehearsal" }).click();
  await expect(hint()).toContainText("Added to First rehearsal");

  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.getByRole("complementary", { name: "Library browser" })).toBeVisible();
  await page.getByRole("button", { name: "Song details" }).click();
  await expect(page.getByRole("complementary", { name: "Song details" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();

  await page.setViewportSize({ width: 390, height: 730 });
  await expect(page.getByRole("complementary", { name: "Library browser" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Soundcheck", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Library" }).click();
  await page.getByRole("button", { name: "Soundcheck", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Soundcheck", exact: true })).toBeVisible();
  await expect(lcd()).toContainText("01/01");
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/phone.png" });
});

test("organizes folders, section order, Nashville numbers, note items and keyboard paging", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Worship");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("button", { name: "Worship", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("This folder is empty", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "All songs" }).click();
  await page.getByRole("button", { name: "Soundcheck", exact: false }).first().click();
  await page.getByRole("button", { name: "Song details" }).click();
  const details = page.getByRole("complementary", { name: "Song details" });
  await details.getByRole("checkbox", { name: "Worship" }).click();
  await expect(details.getByRole("checkbox", { name: "Worship" })).toBeChecked();
  await page.getByRole("button", { name: "Worship", exact: true }).click();
  await expect(page.locator(".browser-scroll .song-row")).toHaveCount(1);

  await details.getByRole("button", { name: "+ Chorus" }).click();
  await details.getByRole("button", { name: "+ Chorus" }).click();
  await expect(page.locator(".fit-page .chart-heading")).toHaveCount(2);
  await details.getByRole("checkbox", { name: "Nashville numbers" }).click();
  await expect(details.getByRole("checkbox", { name: "Nashville numbers" })).toBeChecked();
  await expect(page.locator(".fit-page .chart-part strong").first()).toHaveText("1m");
  await details.getByRole("checkbox", { name: "Nashville numbers" }).click();
  await expect(details.getByRole("checkbox", { name: "Nashville numbers" })).not.toBeChecked();
  await details.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator(".fit-page .chart-heading")).toHaveCount(1);
  await page.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  const set = page.getByRole("button", { name: "First rehearsal", exact: false }).first();
  if (await set.getAttribute("aria-expanded") !== "true") await set.click();
  await page.getByRole("button", { name: "Add note item" }).click();
  await page.getByLabel("Note text").fill("Welcome and count-in");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("button", { name: "2 Welcome and count-in" }).click();
  await expect(page.locator(".note-text")).toHaveText("Welcome and count-in");
  await expect(lcd()).toContainText("02/02");

  // Clicking Perform leaves focus on a button; arrow keys must still move through the set.
  await page.getByRole("button", { name: "Perform" }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Soundcheck", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Library browser" })).toBeVisible();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/studio.png" });
});

test("fits a long song to the screen with columns, pages on a phone, and trailing chords on the chord row", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  const verse = (n: number) => "{start_of_verse: Verse " + n + "}\n" +
    Array.from({ length: 4 }, (_, i) => "[G]Line " + (i + 1) + " of verse " + n + " walks [Em]along the [C]road [D]").join("\n") + "\n{end_of_verse}";
  const chorus = "{start_of_chorus}\n" + Array.from({ length: 4 }, () => "[C]Sing it [G]loud and [D]clear [Em]").join("\n") + "\n{end_of_chorus}";
  const source = ["[Em]Intro [Bm]riff [Am]  [Em] [Am] [D]", verse(1), chorus, verse(2), chorus, verse(3), chorus, verse(4), chorus].join("\n");
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Long medley");
  await page.getByLabel("Source", { exact: true }).fill(source);
  await page.getByRole("button", { name: "Save song" }).click();
  await expect(page.getByRole("heading", { name: "Long medley", exact: true })).toBeVisible();

  const sheet = page.locator(".sheet-scroll");
  await expect(sheet).toHaveAttribute("data-fit", "true");
  await expect(page.locator(".fit-page")).toHaveCount(1);
  await expect(page.locator(".fit-page .fit-column")).not.toHaveCount(1);
  // Everything is visible without scrolling and the text was not shrunk below the readable floor.
  await expect.poll(() => sheet.evaluate(e => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
  const columns = page.locator(".fit-page .fit-column");
  for (let i = 0; i < await columns.count(); i++) {
    await expect.poll(() => columns.nth(i).evaluate(c => c.scrollHeight <= (c.parentElement?.clientHeight ?? 0) + 1)).toBe(true);
  }
  const fontSize = await page.locator(".fit-columns").evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(14);
  await page.mouse.move(5, 5);
  await expect(page.locator("footer.hintbar")).toContainText("1 screen");
  // No row wrapped: every chord sits on the same row as the first chord of its line.
  const wrappedRows = await page.locator(".fit-page .chart-line").evaluateAll(lines => lines.filter(line => {
    const tops = Array.from(line.querySelectorAll("strong")).map(s => Math.round(s.getBoundingClientRect().top));
    return new Set(tops).size > 1;
  }).length);
  expect(wrappedRows).toBe(0);

  // Trailing chords sit on the chord row, level with the line's other chords.
  const intro = page.locator(".fit-page .chart-line").first();
  const tops = await intro.locator("strong").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/fit-desktop.png" });

  await page.setViewportSize({ width: 390, height: 730 });
  await expect.poll(() => page.locator(".fit-page").count()).toBeGreaterThan(1);
  const height = await sheet.evaluate(e => e.clientHeight);
  const pageHeights = await page.locator(".fit-page").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
  expect(pageHeights.every(h => Math.abs(h - height) <= 1)).toBe(true);
  await page.keyboard.press("PageDown");
  await expect.poll(() => sheet.evaluate(e => Math.round(e.scrollTop))).toBe(height);
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/fit-phone.png" });
  await page.setViewportSize({ width: 1360, height: 820 });
});

function pdfFixture() {
  const stream = "0.2 0.4 0.6 rg 25 30 180 90 re f\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 250 180] /Contents 4 0 R >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream",
  ];
  let bytes = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = bytes.length;
    bytes += (i + 1) + " 0 obj\n" + object + "\nendobj\n";
    return offset;
  });
  const xref = bytes.length;
  bytes += "xref\n0 5\n0000000000 65535 f \n" + offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  bytes += "trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n" + xref + "\n%%EOF";
  return Buffer.from(bytes);
}

test("renders a PDF and keeps an annotation after reopening", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator("input[type=file][multiple]").setInputFiles({
    name: "Annotation check.pdf", mimeType: "application/pdf", buffer: pdfFixture()
  });
  await expect(hint()).toContainText("1 added");
  const row = page.getByRole("button", { name: "Annotation check PDF" });
  await row.click();
  const canvas = page.getByLabel("PDF page 1");
  await expect.poll(async () => canvas.evaluate((el: HTMLCanvasElement) => {
    const p = el.getContext("2d")?.getImageData(100,200,1,1).data;
    return p ? Array.from(p) : [];
  })).toEqual([51,102,153,255]);
  await page.getByRole("button", { name: "Song details" }).click();
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  const ink = page.locator("svg.ink");
  await ink.click({ position: { x: 70, y: 100 } });
  await expect(ink.locator("circle")).toHaveCount(1);
  await page.getByRole("button", { name: "Close details" }).click();
  await row.click();
  await expect(ink.locator("circle")).toHaveCount(1);
  await expect(ink).not.toHaveClass(/enabled/);
});

test("loads a local backing track and opens native MIDI port settings", async () => {
  const sampleRate = 8000;
  const dataLength = sampleRate * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(dataLength, 40);
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Audio check");
  await page.getByLabel("Backing track (MP3 or WAV)").setInputFiles({
    name: "One second.wav", mimeType: "audio/wav", buffer: wav
  });
  await expect(page.getByText("One second.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save song" }).click();
  const player = page.getByLabel("Backing track: One second.wav");
  await expect.poll(() => player.evaluate((e: HTMLAudioElement) => e.duration)).toBe(1);
  await page.getByRole("button", { name: "Chromatic tuner" }).click();
  await expect(page.getByRole("dialog", { name: "Chromatic tuner" })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Scan for MIDI ports" }).click();
  await expect(page.getByRole("combobox", { name: "Input", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply connections" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("MIDI ports disconnected");
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("previews and merges the untouched original backup through the Windows UI", async () => {
  const directory = resolve("fixtures/private");
  const candidates = existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && /\.sbpbackup$/i.test(entry.name))
    : [];
  const fixture = process.env.MUSE_SBP_FIXTURE ? resolve(process.env.MUSE_SBP_FIXTURE)
    : candidates.length === 1 ? join(directory, candidates[0].name) : "";
  test.skip(!existsSync(fixture), "Original backup fixture is private.");
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Settings" }).click();
  await page.locator('input[type=file][accept*=".sbpbackup"]').setInputFiles(fixture);
  await expect(page.getByRole("dialog", { name: "Review backup" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("6,621 songs", { exact: false })).toBeVisible();
  await expect(page.getByText("41 set entries", { exact: false })).toBeVisible();
  await expect(page.getByText("Replace mode also restores supported preferences.")).toBeVisible();
  await page.getByRole("button", { name: "Merge library" }).click();
  await expect(hint()).toContainText("2 setlists restored");
  await expect(page.getByRole("dialog")).toBeHidden();
});
