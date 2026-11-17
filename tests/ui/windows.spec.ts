import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let child: ChildProcess;
let data: string;
let browser: Browser;
let page: Page;
/** The app page, not the startup splash (both are served from tauri.localhost). */
const isMain = (url: string) => url.includes("tauri.localhost") && !url.includes("splash");

test.skip(process.platform !== "win32", "This suite drives the Windows WebView2 binary.");
test.beforeAll(async () => {
  const binary = resolve("target/debug/songbook-muse.exe");
  if (!existsSync(binary)) throw new Error("Build the debug binary with npm run tauri -- build --debug --no-bundle");
  data = mkdtempSync(join(tmpdir(), "muse-ui-"));
  mkdirSync(join(data, "exports"));
  const port = 19220;
  child = spawn(binary, [], {
    windowsHide: true,
    env: {
      ...process.env,
      MUSE_TEST_DATA_DIR: join(data, "library"),
      MUSE_TEST_EXPORT_DIR: join(data, "exports"),
      WEBVIEW2_USER_DATA_FOLDER: join(data, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=" + port,
    }
  });
  const endpoint = "http://127.0.0.1:" + port;
  await expect.poll(async () => {
    const response = await fetch(endpoint + "/json/list").catch(() => null);
    const pages = response?.ok ? await response.json() : [];
    return pages.some((target: { url: string }) => isMain(target.url));
  }, { timeout: 25000 }).toBe(true);
  browser = await chromium.connectOverCDP(endpoint);
  page = browser.contexts()[0].pages().find(p => isMain(p.url()))!;
  await expect(page.getByRole("complementary", { name: "Library browser" })).toBeVisible();
});

const hint = () => page.locator("footer.hintbar");
const exportsDir = () => join(data, "exports");
/** Opens Settings on a category of the rail. */
async function openSettings(category: string) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: new RegExp("^" + category) }).click();
}
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
  await sheet.hover({ position: { x: 3, y: 3 } });
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

test("shows chord diagrams in fit and scroll layouts and applies instrument and handedness", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Diagram drill");
  await page.getByLabel("Key", { exact: true }).fill("C");
  await page.getByLabel("Source", { exact: true }).fill("[C]Open [G]strings [Am]ring\n[C]again [Bb]barre");
  await page.getByRole("button", { name: "Save song" }).click();
  const fit = page.getByRole("button", { name: "Fit song to screen" });
  const toggle = page.getByRole("button", { name: "Chord diagrams" });
  const strip = page.getByRole("region", { name: "Chord diagrams" });
  if (await fit.getAttribute("aria-pressed") === "false") await fit.click();
  await expect(strip).toHaveCount(0);
  await toggle.click();
  await expect(page.locator(".fit-page").getByRole("region", { name: "Chord diagrams" }).getByRole("img")).toHaveCount(4);
  const c = strip.getByRole("img", { name: "C on guitar: x 3 2 0 1 0" });
  await expect(c).toBeVisible();
  await expect(strip.getByRole("img", { name: "Bb on guitar", exact: false }).locator(".diagram-barre")).toHaveCount(1);
  const muteX = async () => Number(await c.locator(".diagram-mute").getAttribute("x"));
  const midpoint = Number((await c.getAttribute("viewBox"))!.split(" ")[2]) / 2;
  expect(await muteX()).toBeLessThan(midpoint);

  await fit.click();
  await expect(strip.getByRole("img")).toHaveCount(4);
  const settings = page.getByRole("button", { name: "Settings" });
  const dialog = page.getByRole("dialog");
  const close = page.getByRole("button", { name: "Close dialog" });
  await openSettings("Diagrams");
  await dialog.getByRole("checkbox", { name: "Left handed chord charts" }).check();
  await close.click();
  await expect.poll(muteX).toBeGreaterThan(midpoint);

  await openSettings("Diagrams");
  await dialog.getByRole("radio", { name: /^Ukulele/ }).check();
  await close.click();
  await expect(strip.getByRole("img", { name: "C on ukulele: 0 0 0 3" })).toBeVisible();
  await openSettings("Diagrams");
  await dialog.getByRole("radio", { name: "On chords" }).check();
  await close.click();
  const chord = page.locator(".chart .chord-inline").filter({ hasText: /^C/ }).first();
  await chord.focus();
  await expect(chord.getByRole("img", { name: "C on ukulele: 0 0 0 3" })).toBeVisible();

  await openSettings("Diagrams");
  await dialog.getByRole("radio", { name: /^Guitar/ }).check();
  await dialog.getByRole("checkbox", { name: "Left handed chord charts" }).uncheck();
  await dialog.getByRole("radio", { name: "Off", exact: true }).check();
  await close.click();
  await expect(strip).toHaveCount(0);
  await fit.click();
});

test("renames chords in German and Latin notation while diagrams keep letter names", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Notation drill");
  await page.getByLabel("Source", { exact: true }).fill("[C]one [Bb]two [B7]three [F#m/A]four");
  await page.getByRole("button", { name: "Save song" }).click();
  const fit = page.getByRole("button", { name: "Fit song to screen" });
  if (await fit.getAttribute("aria-pressed") === "false") await fit.click();
  const names = page.locator(".fit-page .chart-part strong");
  const settings = page.getByRole("button", { name: "Settings" });
  const dialog = page.getByRole("dialog");
  const close = page.getByRole("button", { name: "Close dialog" });
  const notationNames: Record<string, RegExp> = { standard: /^Letters/, german: /^German/, latin: /^Latin/ };
  const notation = async (value: string) => {
    await openSettings("Chords");
    await dialog.getByRole("radiogroup", { name: "Chord notation" }).getByRole("radio", { name: notationNames[value] }).check();
    await close.click();
  };
  await expect(names).toHaveText(["C", "Bb", "B7", "F#m/A"]);
  await notation("german");
  await expect(names).toHaveText(["C", "B", "H7", "F#m/A"]);
  await notation("latin");
  await expect(names).toHaveText(["Do", "Sib", "Si7", "Fa#m/La"]);
  const toggle = page.getByRole("button", { name: "Chord diagrams" });
  await toggle.click();
  await expect(page.getByRole("region", { name: "Chord diagrams" }).getByRole("img", { name: "Bb on guitar", exact: false })).toHaveCount(1);
  await toggle.click();
  // The choice persists across a reload.
  await page.reload();
  await page.getByRole("button", { name: "Notation drill", exact: false }).first().click();
  await expect(names.first()).toHaveText("Do");
  await notation("standard");
  await expect(names.first()).toHaveText("C");
});

test("taps a tempo into the metronome, saves it to the song, and auto-stops after ten seconds", async () => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Tempo partner");
  await page.getByLabel("Source", { exact: true }).fill("[D]Next one");
  await page.getByRole("button", { name: "Save song" }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Tempo drill");
  await page.getByLabel("Source", { exact: true }).fill("[G]Count it in");
  await page.getByRole("button", { name: "Save song" }).click();
  await expect(lcd()).toContainText("---");

  // A song without a tempo opens the tempo box on the first start.
  const metronome = page.getByRole("button", { name: /^(Start|Stop) metronome$/ });
  await metronome.click();
  const box = page.getByRole("dialog", { name: "Tempo" });
  await expect(box).toBeVisible();
  await metronome.click();
  await expect(metronome).toHaveAttribute("aria-pressed", "false");

  const pad = box.getByRole("button", { name: "Tap tempo" });
  const bpm = box.getByLabel("Tempo in BPM");
  // Taps are timed inside the page: CDP round-trips would add tens of milliseconds to each gap.
  const tapEvery = (count: number, gap: number) => pad.evaluate((element, [n, ms]) => new Promise<void>(done => {
    let sent = 0;
    const press = () => {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      if (++sent < n) setTimeout(press, ms); else done();
    };
    press();
  }), [count, gap] as const);
  await tapEvery(3, 500);
  await expect(box.getByText("Keep tapping (3/4)")).toBeVisible();
  // A pause over two seconds starts a new run, which needs four taps of its own.
  await page.waitForTimeout(2100);
  await tapEvery(5, 500);
  await expect(box.getByText("Tapped 5 beats")).toBeVisible();
  // Timers jitter on a busy machine; the exact averaging is covered by the Rust tests.
  await expect.poll(async () => Number(await bpm.textContent())).toBeGreaterThanOrEqual(112);
  expect(Number(await bpm.textContent())).toBeLessThanOrEqual(128);
  await box.getByRole("button", { name: "Tempo up" }).click();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/tempo-box.png", clip: { x: 760, y: 0, width: 600, height: 300 } });
  const tapped = Number(await bpm.textContent());
  await expect(lcd()).toContainText(String(tapped));
  await box.getByRole("button", { name: "Save to song" }).click();
  await expect(box.getByRole("button", { name: "Save to song" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Tempo drill", exact: false }).first().click();
  await expect(lcd()).toContainText(String(tapped));
  // A right-click opens the box without starting the click.
  await metronome.click({ button: "right" });
  await expect(box).toBeVisible();
  await expect(metronome).toHaveAttribute("aria-pressed", "false");
  await box.getByRole("button", { name: "Close tempo" }).click();

  const settings = page.getByRole("button", { name: "Settings" });
  const timeoutNames: Record<string, string> = { never: "Never", "10s": "After 10 s", "10s_resume": "10 s, again per song" };
  const timeout = async (value: string) => {
    await openSettings("Performance");
    await page.getByRole("dialog").getByRole("radio", { name: timeoutNames[value] }).check();
    await page.getByRole("button", { name: "Close dialog" }).click();
  };
  await timeout("10s_resume");
  await metronome.click();
  await expect(metronome).toHaveAttribute("aria-pressed", "true");
  await expect(metronome).toHaveAttribute("aria-pressed", "false", { timeout: 13000 });
  await page.getByRole("button", { name: "Tempo partner", exact: false }).first().click();
  await expect(metronome).toHaveAttribute("aria-pressed", "true");
  await metronome.click();
  await timeout("10s");
  await page.getByRole("button", { name: "Tempo drill", exact: false }).first().click();
  await expect(metronome).toHaveAttribute("aria-pressed", "false");
  await timeout("never");
});

test("navigates settings by category and search, previews chords, and resets a section", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await openSettings("Display");
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const rail = dialog.getByRole("navigation", { name: "Settings categories" });
  await expect(rail.getByRole("button")).toHaveCount(6);
  await expect(rail.getByRole("button", { name: /^Display/ })).toHaveAttribute("aria-current", "page");

  // Theme cards apply at once and the rail summary follows.
  await dialog.getByRole("radio", { name: /^Daylight/ }).check();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "light");
  await expect(rail.getByRole("button", { name: /^Display/ })).toHaveAttribute("title", /Daylight/);
  await expect(dialog.locator(".settings-status")).toContainText("Daylight");
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/settings-display-light.png" });
  await dialog.getByRole("button", { name: "Reset Theme" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  await expect(dialog.getByRole("button", { name: "Reset Theme" })).toBeDisabled();

  // The chord preview renders the sample with the live notation and key spelling.
  await rail.getByRole("button", { name: /^Chords/ }).click();
  const preview = dialog.getByRole("figure", { name: "Chord preview" });
  await expect(preview.locator(".chart-part strong").first()).toHaveText("G");
  await expect(preview.locator(".chart-part strong").nth(5)).toHaveText("Bb");
  await dialog.getByRole("radio", { name: /^German/ }).check();
  await expect(preview.locator(".chart-part strong").nth(5)).toHaveText("B");
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/settings-chords.png" });
  await dialog.getByRole("button", { name: "Reset Notation" }).click();
  await expect(dialog.getByRole("radio", { name: /^Letters/ })).toBeChecked();

  // Search spans every category and labels each result with its category.
  const search = dialog.getByRole("searchbox", { name: "Search settings" });
  await search.fill("flats");
  await expect(dialog.getByRole("region", { name: "Search results" })).toContainText("Chords");
  await expect(dialog.getByText("Prefer flats when the key is unknown or ambiguous")).toBeVisible();
  await search.fill("zzzz");
  await expect(dialog.getByText("No settings match", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Clear search" }).click();
  await expect(rail.getByRole("button", { name: /^Chords/ })).toHaveAttribute("aria-current", "page");

  if (process.env.MUSE_UI_SCREENSHOTS) {
    for (const tab of ["Diagrams", "Performance", "Controllers", "Display"]) {
      await rail.getByRole("button", { name: new RegExp("^" + tab) }).click();
      await page.waitForTimeout(150);
      await page.screenshot({ path: "test-results/settings-" + tab.toLowerCase() + ".png" });
    }
  }
  // The text size field accepts typed values and clamps them to the valid range.
  await rail.getByRole("button", { name: /^Display/ }).click();
  const size = dialog.getByLabel("Text size (%)", { exact: true });
  await size.fill("500");
  await size.press("Enter");
  await expect(size).toHaveValue("200");
  await dialog.getByRole("button", { name: "Reset Song view" }).click();
  await expect(size).toHaveValue("100");

  // Phone width turns the rail into a scrolling tab strip above the page.
  await page.setViewportSize({ width: 390, height: 780 });
  await rail.getByRole("button", { name: /^Performance/ }).click();
  await expect(dialog.getByLabel("Default scroll time (seconds)", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/settings-phone.png" });
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("edits a song with insert tools, section chips, duration checks and a discard prompt", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  const editor = page.getByRole("dialog", { name: "New song" });
  const save = editor.getByRole("button", { name: "Save song" });
  await expect(save).toBeDisabled();
  await expect(editor.getByText("A title is required")).toBeVisible();
  await editor.getByLabel("Title", { exact: true }).fill("Editor drill");

  // Insert tools wrap the selection or drop a placeholder at the cursor.
  const source = editor.getByLabel("Source", { exact: true });
  await source.fill("Opening line");
  await source.evaluate((e: HTMLTextAreaElement) => e.setSelectionRange(e.value.length, e.value.length));
  await editor.getByRole("button", { name: "Insert chorus" }).click();
  await expect(source).toHaveValue(["Opening line", "{start_of_chorus}", "[G]Lyrics", "{end_of_chorus}", ""].join(String.fromCharCode(10)));
  await expect(editor.getByText("5 lines · 1 chord")).toBeVisible();

  // Detected sections become chips that build the order.
  const chips = editor.getByRole("group", { name: "Add a section to the order" });
  await chips.getByRole("button", { name: "Chorus" }).click();
  await chips.getByRole("button", { name: "Chorus" }).click();
  await expect(editor.getByLabel("Section order", { exact: true })).toHaveValue("Chorus, Chorus");
  await expect(editor.getByRole("region", { name: "Live preview" }).locator(".chart-heading")).toHaveCount(2);

  const duration = editor.getByLabel("Duration", { exact: true });
  await duration.fill("3:7");
  await expect(editor.getByText("Duration must look like 3:25 or 205")).toBeVisible();
  await expect(save).toBeDisabled();
  await duration.fill("3:25");
  await expect(editor.getByText("Unsaved changes", { exact: false })).toBeVisible();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/editor-desktop.png" });

  // Closing with changes asks first.
  await page.keyboard.press("Escape");
  await expect(editor.getByRole("alert")).toContainText("Discard your changes");
  await editor.getByRole("button", { name: "Keep editing" }).click();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue("Editor drill");

  // Narrow windows switch between source and preview.
  await page.setViewportSize({ width: 390, height: 780 });
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(editor.getByRole("region", { name: "Live preview" })).toBeVisible();
  await expect(source).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/editor-phone.png" });
  await page.setViewportSize({ width: 1360, height: 820 });

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Editor drill", exact: true })).toBeVisible();
});

test("drags a setlist item past several positions and keeps the new order", async () => {
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  await page.getByRole("button", { name: "New setlist" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Drag ordering");
  await page.getByRole("button", { name: "Save setlist" }).click();
  const set = page.getByRole("button", { name: /Drag ordering/ });
  if (await set.getAttribute("aria-expanded") === "false") await set.click();
  for (const title of ["First note", "Second note", "Third note"]) {
    await page.getByRole("button", { name: "Add note item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Note text").fill(title);
    await dialog.getByRole("button", { name: "Save note" }).click();
    await expect(dialog).toHaveCount(0);
  }
  const entries = page.locator(".set-entry");
  const names = entries.locator(".entry-title");
  await expect(names).toHaveText(["First note", "Second note", "Third note"]);
  await entries.nth(0).locator(".set-entry-handle").dragTo(entries.nth(2));
  await expect(names).toHaveText(["Second note", "Third note", "First note"]);
  await page.reload();
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  await set.click();
  await expect(names).toHaveText(["Second note", "Third note", "First note"]);
});

test("keeps a section arrangement local to one occurrence of a song", async () => {
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  await page.getByRole("button", { name: "New setlist" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Arrangement set");
  await page.getByRole("button", { name: "Save setlist" }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Arrangement check");
  await page.getByLabel("Section order", { exact: true }).fill("Verse 1");
  await page.getByLabel("Source", { exact: true }).fill(
    "{start_of_verse: Verse 1}\n[C]First line\n{end_of_verse}\n{start_of_chorus}\n[G]Refrain\n{end_of_chorus}");
  await page.getByRole("button", { name: "Save song" }).click();
  const fit = page.getByRole("button", { name: "Fit song to screen" });
  if (await fit.getAttribute("aria-pressed") === "false") await fit.click();
  const headings = page.locator(".fit-page .chart-heading");
  await expect(headings).toHaveText(["Verse 1"]);

  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Song actions" }).click();
    await page.getByRole("menuitem", { name: "Add to setlist" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Arrangement set" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  const set = page.getByRole("button", { name: /Arrangement set/ });
  if (await set.getAttribute("aria-expanded") === "false") await set.click();
  const occurrence = (index: number) => page.getByRole("button", { name: index + " Arrangement check", exact: true });
  await occurrence(1).click();
  await page.getByRole("button", { name: "Song details" }).click();
  const details = page.getByRole("complementary", { name: "Song details" });
  await details.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(headings).toHaveText(["Verse 1", "Chorus"]);
  await details.getByRole("button", { name: "+ Chorus" }).click();
  await expect(headings).toHaveText(["Chorus"]);
  await occurrence(2).click();
  await expect(headings).toHaveText(["Verse 1"]);
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: /Arrangement check Chord sheet/ }).click();
  await expect(headings).toHaveText(["Verse 1"]);

  await page.reload();
  await page.getByRole("button", { name: "Setlists", exact: true }).click();
  await set.click();
  await occurrence(1).click();
  await expect(headings).toHaveText(["Chorus"]);
  await page.getByRole("button", { name: "Song details" }).click();
  await details.getByRole("button", { name: "Use song order" }).click();
  await expect(headings).toHaveText(["Verse 1"]);
});

test("starts delayed auto-scroll on the second press and saves the song scroll time", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "All songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Auto-scroll chart");
  await page.getByLabel("Source", { exact: true }).fill(Array.from({ length: 70 }, (_, i) => "[G]Line " + (i + 1)).join("\n"));
  await page.getByRole("button", { name: "Save song" }).click();

  const fit = page.getByRole("button", { name: "Fit song to screen" });
  const wasFit = await fit.getAttribute("aria-pressed") === "true";
  if (wasFit) await fit.click();
  const sheet = page.locator(".sheet-scroll");
  await expect.poll(() => sheet.evaluate(e => e.scrollHeight - e.clientHeight)).toBeGreaterThan(400);
  const songDetails = page.getByRole("button", { name: "Song details" });
  if (await songDetails.getAttribute("aria-pressed") === "false") await songDetails.click();
  const time = page.getByRole("group", { name: "Scroll time" });
  await expect(time.locator("output")).toHaveText("1:30");
  await time.getByRole("button", { name: "Scroll time up" }).click();
  await expect(time.locator("output")).toHaveText("1:45");
  await page.getByRole("button", { name: "Close details" }).click();

  await page.getByRole("button", { name: "Start auto-scroll (A)", exact: true }).click();
  const startNow = page.getByRole("button", { name: "Start auto-scroll now (A)", exact: true });
  await expect(startNow).toHaveAttribute("aria-pressed", "true");
  expect(await sheet.evaluate(e => e.scrollTop)).toBe(0);
  await startNow.click();
  await expect.poll(() => sheet.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop auto-scroll (A)", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-autoscroll", "false");

  await page.getByRole("button", { name: "Auto-scroll chart Chord sheet" }).click();
  await songDetails.click();
  await expect(time.locator("output")).toHaveText("1:45");
  await page.getByRole("button", { name: "Close details" }).click();
  if (wasFit) await fit.click();
});

test("uses the default chart scroll time and adds half a viewport below long charts", async () => {
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Overscroll chart");
  await page.getByLabel("Source", { exact: true }).fill(Array.from({ length: 80 }, (_, i) => "[D]Overscroll " + i).join("\n"));
  await page.getByRole("button", { name: "Save song" }).click();
  const fit = page.getByRole("button", { name: "Fit song to screen" });
  if (await fit.getAttribute("aria-pressed") === "true") await fit.click();
  const sheet = page.locator(".sheet-scroll");
  async function pollSheet() { return sheet.evaluate(e => e.scrollHeight - e.clientHeight); }
  await expect.poll(pollSheet).toBeGreaterThan(400);
  const baseline = await pollSheet();
  const half = await sheet.evaluate(e => e.clientHeight / 2);

  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await openSettings("Performance");
  await page.getByLabel("Default scroll time (seconds)", { exact: true }).fill("120");
  await page.getByLabel("Default scroll time (seconds)", { exact: true }).press("Tab");
  await page.getByLabel("Overscroll by half a screen").check();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect.poll(async () => Math.abs(await pollSheet() - baseline - half)).toBeLessThanOrEqual(2);

  await page.reload();
  await page.getByRole("button", { name: "Overscroll chart Chord sheet" }).click();
  await expect(sheet).toHaveAttribute("data-overscroll", "true");
  await page.getByRole("button", { name: "Song details" }).click();
  await expect(page.getByRole("group", { name: "Scroll time" }).locator("output")).toHaveText("2:00");
  await page.getByRole("button", { name: "Close details" }).click();
  await fit.click();
  await expect(sheet).toHaveAttribute("data-overscroll", "false");
  await openSettings("Performance");
  await page.getByLabel("Default scroll time (seconds)", { exact: true }).fill("90");
  await page.getByLabel("Default scroll time (seconds)", { exact: true }).press("Tab");
  await page.getByLabel("Overscroll by half a screen").uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("shows ChordPro lyric color and fill in the editor and fit viewer", async () => {
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Color chart");
  await page.getByLabel("Source", { exact: true }).fill("{c: Verse 1}\n{textcolour: #F00}\n{textfill: yellow}\n[C]Highlighted\n{textcolor}\n[G]Fill only\n{c: Chorus}\n[D]Default lyric");
  const highlighted = (root: typeof page | ReturnType<typeof page.locator>) => root.getByText("Highlighted", { exact: true });
  await expect(highlighted(page.getByRole("dialog"))).toHaveCSS("color", "rgb(255, 0, 0)");
  await page.getByRole("button", { name: "Save song" }).click();
  const chart = page.locator(".fit-page .chart");
  await expect(highlighted(chart)).toHaveCSS("background-color", "rgb(255, 255, 0)");
  await expect(chart.getByText("Fill only", { exact: true })).not.toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(chart.getByText("Default lyric", { exact: true })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(chart.getByText("C", { exact: true })).not.toHaveCSS("color", "rgb(255, 0, 0)");
});

test("learns a keyboard pedal, applies its assigned action, and remembers it after reloading", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "All songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Pedal rehearsal");
  await page.getByLabel("Source", { exact: true }).fill(Array.from({ length: 70 }, (_, i) => "[G]Line " + (i + 1)).join("\n"));
  await page.getByRole("button", { name: "Save song" }).click();
  const fit = page.getByRole("button", { name: "Fit song to screen" });
  const wasFit = await fit.getAttribute("aria-pressed") === "true";
  if (wasFit) await fit.click();

  const settings = page.getByRole("button", { name: "Settings" });
  const close = page.getByRole("button", { name: "Close dialog" });
  const add = page.getByRole("button", { name: "Add pedal action" });
  const pedal = page.getByRole("combobox", { name: "p", exact: true });
  await openSettings("Controllers");
  await add.click();
  await expect(page.getByRole("button", { name: "Press a pedal" })).toBeFocused();
  await page.keyboard.press("p");
  await expect(pedal).toHaveValue("page_down");
  await pedal.selectOption("page_up");
  await add.click();
  await page.keyboard.press("p");
  await expect(page.getByText("p is already assigned")).toBeVisible();
  await expect(pedal).toHaveValue("page_up");
  await close.click();

  await page.reload();
  await page.getByRole("button", { name: "Pedal rehearsal Chord sheet" }).click();
  const sheet = page.locator(".sheet-scroll");
  await expect.poll(() => sheet.evaluate(e => e.scrollHeight - e.clientHeight)).toBeGreaterThan(400);
  await page.keyboard.press("PageDown");
  await expect.poll(() => sheet.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  const before = await sheet.evaluate(e => e.scrollTop);

  const search = page.getByRole("searchbox", { name: "Search songs" });
  await search.focus();
  await page.keyboard.press("p");
  await expect(search).toHaveValue("p");
  expect(await sheet.evaluate(e => e.scrollTop)).toBe(before);
  await search.fill("");
  await openSettings("Controllers");
  await expect(pedal).toHaveValue("page_up");
  await page.keyboard.press("p");
  expect(await sheet.evaluate(e => e.scrollTop)).toBe(before);
  await close.click();
  await page.keyboard.press("p");
  await expect.poll(() => sheet.evaluate(e => e.scrollTop)).toBeLessThanOrEqual(1);

  await openSettings("Controllers");
  await page.getByRole("button", { name: "Remove pedal p" }).click();
  await expect(pedal).toHaveCount(0);
  await close.click();
  if (wasFit) await fit.click();
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

test("renders a PDF, inverts the page without the ink, and keeps both settings and ink after reopening", async () => {
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator("input[type=file][multiple]").setInputFiles({
    name: "Annotation check.pdf", mimeType: "application/pdf", buffer: pdfFixture()
  });
  await expect(hint()).toContainText("1 added");
  const row = page.getByRole("button", { name: "Annotation check PDF" });
  await row.click();
  const canvas = page.getByLabel("PDF page 1");
  await expect(canvas).toHaveCSS("filter", "none");
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
  const settings = page.getByRole("button", { name: "Settings" });
  const invert = page.getByRole("checkbox", { name: "Invert PDF colors" });
  await openSettings("Display");
  await invert.check();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(canvas).toHaveCSS("filter", "invert(1)");
  await expect(ink).toHaveCSS("filter", "none");

  await page.reload();
  await row.click();
  await expect(canvas).toHaveCSS("filter", "invert(1)");
  await expect(ink.locator("circle")).toHaveCount(1);
  await expect(ink).not.toHaveClass(/enabled/);
  await openSettings("Display");
  await invert.uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(canvas).toHaveCSS("filter", "none");
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
  await openSettings("Controllers");
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
  await openSettings("Library");
  await page.locator('input[type=file][accept*=".sbpbackup"]').setInputFiles(fixture);
  const wizard = page.getByRole("dialog", { name: "Restore backup" });
  await expect(wizard).toBeVisible();
  await expect(wizard.getByText(/^6,621 songs · .* · preferences$/)).toBeVisible();
  await expect(wizard.getByRole("radio", { name: "Merge" })).toBeChecked();
  await wizard.getByRole("button", { name: "Merge library" }).click();
  // Merging thousands of songs takes a while in a debug build.
  await expect(wizard.getByRole("status")).toContainText("Library merged", { timeout: 90000 });
  await expect(hint()).toContainText("2 setlists restored");
  await wizard.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("exports a backup and replaces the library only after saving a safety backup", async () => {
  // The library may already hold the private original backup's thousands of songs.
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Backup keeper");
  await page.getByLabel("Source", { exact: true }).fill("[A]Keep me");
  await page.getByRole("button", { name: "Save song" }).click();

  await openSettings("Library");
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const rail = dialog.getByRole("navigation", { name: "Settings categories" });
  await dialog.getByRole("button", { name: "Export backup" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Backup saved", { timeout: 60000 });
  await expect(rail.getByRole("button", { name: /^Library/ })).toHaveAttribute("title", "Exported just now");
  await expect(dialog.getByRole("group", { name: "Library contents" })).toContainText("OK");
  const exported = readdirSync(exportsDir()).filter(name => /^SongBookMuse \d{4}-\d\d-\d\d\.musebackup$/.test(name));
  expect(exported).toHaveLength(1);
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/settings-library.png" });

  // A song added after the export disappears when the export replaces the library.
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Added after export");
  await page.getByLabel("Source", { exact: true }).fill("[E]Gone soon");
  await page.getByRole("button", { name: "Save song" }).click();

  await openSettings("Library");
  await page.locator('input[type=file][accept*=".sbpbackup"]').setInputFiles(join(exportsDir(), exported[0]));
  const wizard = page.getByRole("dialog", { name: "Restore backup" });
  // Previewing a large library backup takes a while.
  await expect(wizard).toBeVisible({ timeout: 60000 });
  await expect(wizard.getByRole("list", { name: "Warnings" })).toHaveCount(0);
  await expect(wizard.getByRole("radio", { name: "Merge" })).toBeChecked();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/restore-mode.png" });
  await wizard.getByRole("radio", { name: "Replace" }).check();
  await expect(wizard.getByText("Your preferences are replaced by the backup's.", { exact: false })).toBeVisible();

  // Turning the safety backup off requires an explicit acknowledgement.
  const safety = wizard.getByRole("checkbox", { name: "Save a safety backup of my current library first" });
  const replace = wizard.getByRole("button", { name: "Replace library" });
  await expect(safety).toBeChecked();
  await safety.uncheck();
  await expect(replace).toBeDisabled();
  await wizard.getByRole("checkbox", { name: /I understand/ }).check();
  await expect(replace).toBeEnabled();
  await safety.check();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/restore-confirm.png" });
  await replace.click();
  await expect(wizard.getByRole("status")).toContainText("Library replaced", { timeout: 90000 });
  await expect(wizard.getByText("saved as a safety backup", { exact: false })).toBeVisible();
  if (process.env.MUSE_UI_SCREENSHOTS) await page.screenshot({ path: "test-results/restore-done.png" });
  expect(readdirSync(exportsDir()).some(name => name.startsWith("SongBookMuse before restore "))).toBe(true);
  await wizard.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Backup keeper", exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Added after export", exact: false })).toHaveCount(0);
});

test("draws its own window controls and blocks the browser context menu", async () => {
  const controls = page.getByRole("group", { name: "Window" });
  await expect(controls.getByRole("button", { name: "Minimize" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Close" })).toBeVisible();
  const maximize = controls.getByRole("button", { name: /^(Maximize|Restore)$/ });
  const before = await maximize.getAttribute("aria-label");
  await maximize.click();
  await expect(maximize).not.toHaveAttribute("aria-label", before!);
  await maximize.click();
  await expect(maximize).toHaveAttribute("aria-label", before!);

  const blocked = await page.evaluate(() => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    document.querySelector(".lcd")!.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(blocked).toBe(true);
});

test("shows the main window after the splash and closes the splash", async () => {
  await expect.poll(() => page.evaluate(() => document.visibilityState), { timeout: 25000 }).toBe("visible");
  await expect.poll(async () => {
    const targets: { url: string }[] = await (await fetch("http://127.0.0.1:19220/json/list")).json();
    return targets.some(target => target.url.includes("splash"));
  }, { timeout: 25000 }).toBe(false);
});
