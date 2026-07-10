import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");
const html = await readFile(new URL("../outputs/sigil-vault.html", import.meta.url), "utf8");
const scriptMatch = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .find(match => match[1].includes("const MAGIC = [0x53, 0x47, 0x56, 0x31]"));
assert(scriptMatch, "application script not found");

globalThis.document = {
  getElementById(id) {
    if (id === "gridSize" || id === "scale") return { value: "auto" };
    return null;
  },
  createElement(tag) {
    if (tag === "canvas") return createCanvas(1, 1);
    throw new Error(`unsupported test element: ${tag}`);
  }
};
globalThis.window = {};

const hook = '    $("tabMake").addEventListener("click", () => switchTab("make"));';
const exposed = `
    globalThis.Scanner3Core = {
      FEC_PROFILES, KDF_PROFILES, crc32, encodeEnvelope, encodePayloadFrame, wrapPayload,
      chooseGrid, chooseScale, renderSigil, decodePackageFromCanvas,
      centeredCameraRegion, decodeCameraRegion, makeSettingsReport, state,
      scanner2LocateRegions, cropCanvas, scanner3TryCandidate, scanner2TryCandidate,
      makeDegradedRender, assessCameraQuality, fuseAlignedCameraFrames,
      projectionBoundsCandidate, paperBoundsCandidate, tryDecodeSourceVariants,
      estimatePaperQuad, paperPerspectiveCandidate, tryDecodeBoundedCandidate
    };
    return;
`;
new Function(scriptMatch[1].replace(hook, exposed + hook))();

const core = globalThis.Scanner3Core;
const body = core.encodeEnvelope(
  Uint8Array.from({ length: 180 }, (_, i) => (i * 73 + 19) & 255),
  Uint8Array.from({ length: 32 }, (_, i) => i + 1),
  Uint8Array.from({ length: 12 }, (_, i) => i + 33),
  core.KDF_PROFILES.fast
);
const frame = core.encodePayloadFrame(body, core.FEC_PROFILES.standard);
const mode = 2;
const grid = core.chooseGrid(frame.length + 13, mode);
const render = {
  syms: core.wrapPayload(frame, core.crc32(body), mode, grid),
  grid,
  mode,
  scale: core.chooseScale(grid),
  shape: "mosaic",
  paletteHex: ["#000000", "#555555", "#aaaaaa", "#ffffff"],
  backgroundMode: "palette",
  backgroundColor: "#0d1117"
};

const code = createCanvas(1, 1);
core.renderSigil(code, render);
const direct = await core.decodePackageFromCanvas(code);
assert.equal(direct.body.kind, "locked", "direct rendered decode failed");
for (const kind of ["scaled", "faded"]) {
  const degraded = await core.decodePackageFromCanvas(core.makeDegradedRender(render, kind));
  assert.equal(degraded.body.kind, "locked", `${kind} quality test failed`);
}

const binaryMode = 1;
const binaryGrid = core.chooseGrid(frame.length + 13, binaryMode);
const binaryRender = {
  ...render,
  syms: core.wrapPayload(frame, core.crc32(body), binaryMode, binaryGrid),
  grid: binaryGrid,
  mode: binaryMode,
  scale: core.chooseScale(binaryGrid),
  paletteHex: ["#000000", "#ffffff"]
};
const binaryCode = createCanvas(1, 1);
core.renderSigil(binaryCode, binaryRender);
const binaryDirect = await core.decodePackageFromCanvas(binaryCode);
assert.equal(binaryDirect.body.kind, "locked", "two-color decode failed");

const screenshot = createCanvas(1360, 900);
const screenshotContext = screenshot.getContext("2d");
screenshotContext.fillStyle = "#d7dbe2";
screenshotContext.fillRect(0, 0, screenshot.width, screenshot.height);
screenshotContext.fillStyle = "#1d2430";
screenshotContext.fillRect(60, 60, 520, 72);
screenshotContext.imageSmoothingEnabled = false;
screenshotContext.drawImage(code, 600, 82);
const screenshotRegions = await core.scanner2LocateRegions(screenshot);
assert(screenshotRegions.regions.length > 0, "Scanner 2 found no screenshot candidate regions");
const located = await core.decodePackageFromCanvas(screenshot);
assert.equal(located.body.kind, "locked", "full screenshot decode failed");
assert(["projection-fast", "projection-perspective", "projection-inset", "scanner3-perspective"].includes(located.scanPath), `unexpected scan path: ${located.scanPath}`);

const paper = createCanvas(1200, 1000);
const paperContext = paper.getContext("2d");
paperContext.fillStyle = "#ffffff";
paperContext.fillRect(0, 0, paper.width, paper.height);
paperContext.save();
paperContext.translate(600, 500);
paperContext.rotate(Math.PI / 90);
paperContext.imageSmoothingEnabled = true;
paperContext.drawImage(code, -300, -300, 600, 600);
paperContext.restore();
const paperResult = await core.decodePackageFromCanvas(paper);
assert.equal(paperResult.body.kind, "locked", "white-paper decode failed");
assert(["paper-quad", "paper-fast", "paper-perspective", "paper-inset", "projection-fast", "projection-perspective", "projection-inset", "scanner3-perspective"].includes(paperResult.scanPath), `unexpected paper scan path: ${paperResult.scanPath}`);

const camera = createCanvas(960, 540);
const cameraContext = camera.getContext("2d");
cameraContext.fillStyle = "#8b919a";
cameraContext.fillRect(0, 0, camera.width, camera.height);
cameraContext.imageSmoothingEnabled = false;
cameraContext.drawImage(code, 300, 90, 360, 360);
const cameraStartedAt = Date.now();
const cameraResult = core.decodeCameraRegion(camera, core.centeredCameraRegion(camera, .78));
const cameraMs = Date.now() - cameraStartedAt;
assert(cameraResult.decoded, "centered camera decode failed");
assert.equal(cameraResult.decoded.body.kind, "locked");
const quality = core.assessCameraQuality(camera);
assert.equal(quality.blocked, false, `camera quality rejected test frame: ${quality.message}`);
const fusedCamera = core.fuseAlignedCameraFrames([code, code]);
assert(fusedCamera, "aligned camera fusion failed");

core.state.lastBaseName = "Test Vault";
core.state.lastEntries = [{ password: "must-not-leak", text: "must-not-leak" }];
const report = await core.makeSettingsReport({
  ...render,
  kdfProfile: core.KDF_PROFILES.fast,
  fecProfile: core.FEC_PROFILES.standard
}, [{ name: "Test Vault/PNG/Test.png", data: Uint8Array.of(1, 2, 3) }], new Date("2026-07-10T12:00:00Z"));
assert.match(report, /KDF: Argon2id \+ HKDF-SHA-256/);
assert.match(report, /SHA-256\s+[0-9a-f]{64}/);
assert(!report.includes("must-not-leak"), "ZIP settings leaked secret content");

console.log(`LayerLock Scanner 3 rendered smoke: OK; screenshot ${Math.round(located.scanMs)} ms; centered camera ${cameraMs} ms`);
