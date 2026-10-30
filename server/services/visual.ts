import { PNG } from "pngjs";
import type {
  Evidence,
  Rect,
  Scan,
  VisualDiff,
  VisualMask,
  VisualPair,
} from "../../shared/types.js";
import { canonical, sameExecution } from "./comparison.js";

export function visualPairs(before: Scan, after: Scan): VisualPair[] {
  if (before.projectId !== after.projectId || before.id === after.id)
    throw new Error("Zwei unterschiedliche Checks desselben Projekts wählen.");
  const a = before.result?.audit,
    b = after.result?.audit;
  if (!a || !b) throw new Error("Gespeicherte Berichte fehlen.");
  return a.evidence.map((old) => {
    const next = b.evidence.find(
      (item) =>
        item.pageUrl === old.pageUrl &&
        item.viewportId === old.viewportId &&
        item.state === old.state,
    );
    let reason =
      "Gleiche Aufnahmebedingungen; Pixeländerungen sind keine Regelverletzungen.";
    if (!next)
      reason =
        "Diese Seite, Ansicht oder dieser Scrollzustand wurde nicht erneut aufgenommen.";
    else if (before.status !== "completed" || after.status !== "completed")
      reason = "Nur abgeschlossene Checks vergleichen.";
    else if (!sameExecution(a, b))
      reason =
        "Engine, Browser oder Ausführungsumgebung unterscheiden sich oder sind unbekannt.";
    else if (
      old.capture?.stateReady === false ||
      next.capture?.stateReady === false
    )
      reason =
        "Interaktionszustand wurde nicht bestätigt; kein numerischer Bildvergleich.";
    else if (!old.capture || !next.capture)
      reason =
        "Historische Aufnahmebedingungen fehlen. Kein belastbarer Pixelvergleich.";
    else if (!old.capture.fontsReady || !next.capture.fontsReady)
      reason = "Schriften waren nicht nachweislich fertig geladen.";
    else if (
      canonical(old.capture) !== canonical(next.capture) ||
      canonical(a.options.viewports.find((p) => p.id === old.viewportId)) !==
        canonical(b.options.viewports.find((p) => p.id === next.viewportId)) ||
      old.width !== next.width ||
      old.height !== next.height ||
      Math.abs(old.scrollX - next.scrollX) > 1 ||
      Math.abs(old.scrollY - next.scrollY) > 1
    )
      reason =
        "Aufnahmebedingungen, Ziel-URL, Größe oder Scrollposition unterscheiden sich.";
    else return { before: old, after: next, comparable: true, reason };
    return { before: old, after: next, comparable: false, reason };
  });
}
export function validateMasks(
  value: unknown,
  evidence: Evidence[],
): VisualMask[] {
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("Maximal 30 ausdrückliche Masken pro Referenz.");
  return value.map((item) => {
    const capture = evidence.find((e) => e.id === item?.evidenceId),
      r = item?.rect;
    if (
      !capture ||
      !r ||
      Object.keys(r).sort().join() !== "height,width,x,y" ||
      ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
      r.x < 0 ||
      r.y < 0 ||
      r.width < 1 ||
      r.height < 1 ||
      r.x + r.width > capture.width ||
      r.y + r.height > capture.height
    )
      throw new Error(
        "Maske muss als ganzzahliges Rechteck innerhalb der gespeicherten Aufnahme liegen.",
      );
    return {
      evidenceId: capture.id,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}
function decode(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (
    b.length < 24 ||
    b.length > 20 * 1024 * 1024 ||
    b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error("Ungültige oder zu große PNG-Aufnahme.");
  const w = b.readUInt32BE(16),
    h = b.readUInt32BE(20);
  if (!w || !h || w > 4096 || h > 4096 || w * h > 12_000_000)
    throw new Error("Bild überschreitet das sichere Pixelbudget.");
  return PNG.sync.read(b);
}
export function diffPng(
  before: Uint8Array,
  after: Uint8Array,
  masks: Rect[] = [],
): VisualDiff {
  const a = decode(before),
    b = decode(after);
  if (a.width !== b.width || a.height !== b.height)
    throw new Error("Bildgrößen stimmen nicht überein.");
  const { width, height } = a,
    total = width * height,
    excluded = new Uint8Array(total),
    output = new PNG({ width, height });
  if (masks.length > 30) throw new Error("Zu viele Masken.");
  for (const r of masks) {
    if (
      ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
      r.x < 0 ||
      r.y < 0 ||
      r.width < 1 ||
      r.height < 1 ||
      r.x + r.width > width ||
      r.y + r.height > height
    )
      throw new Error("Ungültige Bildmaske.");
    for (let y = r.y; y < r.y + r.height; y++)
      excluded.fill(1, y * width + r.x, y * width + r.x + r.width);
  }
  let changedPixels = 0,
    maskedPixels = 0;
  const threshold = 24,
    tile = 32,
    columns = Math.ceil(width / tile),
    tiles = new Set<number>();
  for (let i = 0; i < total; i++) {
    const at = i * 4;
    if (excluded[i]) {
      maskedPixels++;
      output.data.set([190, 190, 190, 255], at);
      continue;
    }
    const changed = [0, 1, 2, 3].some(
      (c) => Math.abs(a.data[at + c]! - b.data[at + c]!) > threshold,
    );
    if (changed) {
      changedPixels++;
      tiles.add(
        Math.floor(Math.floor(i / width) / tile) * columns +
          Math.floor((i % width) / tile),
      );
      output.data.set([226, 45, 105, 255], at);
    } else {
      const grey = Math.round(
        (a.data[at]! + a.data[at + 1]! + a.data[at + 2]!) / 3,
      );
      output.data.set([grey, grey, grey, 255], at);
    }
  }
  if (maskedPixels === total)
    throw new Error(
      "Die Masken verdecken das gesamte Bild. Kein bewertbarer Vergleich.",
    );
  const regions: Rect[] = [];
  // Adjacent changed tiles form bounded regions, not detected DOM elements.
  while (tiles.size) {
    const first = tiles.values().next().value!;
    tiles.delete(first);
    const queue = [first];
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i]!,
        x = t % columns,
        y = Math.floor(t / columns);
      minX = Math.min(minX, x * tile);
      minY = Math.min(minY, y * tile);
      maxX = Math.max(maxX, Math.min(width, (x + 1) * tile));
      maxY = Math.max(maxY, Math.min(height, (y + 1) * tile));
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx! < 0 || nx! >= columns || ny! < 0) continue;
        const n = ny! * columns + nx!;
        if (tiles.delete(n)) queue.push(n);
      }
    }
    if (regions.length < 50)
      regions.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
  }
  return {
    width,
    height,
    changedPixels,
    comparedPixels: total - maskedPixels,
    maskedPixels,
    changedPercent: (changedPixels / (total - maskedPixels)) * 100,
    threshold,
    regions,
    image: `data:image/png;base64,${PNG.sync.write(output).toString("base64")}`,
  };
}
