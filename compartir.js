// =============================
// COMPARTIR Y EXPORTAR
// =============================
// Entrenos y pasadas del Historial en tres formatos, todos armados en el
// celular (sin conexión):
//   · Mensaje: texto con formato de WhatsApp (*negrita*), para el grupo.
//   · Imagen: tarjeta PNG con el logo del club, para ver en el celular.
//   · Planilla: .xlsx (Excel, Google Sheets, Numbers) para el registro.
// Se manda con el menú de compartir del celular (WhatsApp, Mail, Drive,
// Archivos...). Donde no existe (computadora) el texto se copia y los
// archivos se descargan.

import {
  history, escapeHtml, formatClock, formatDuration, formatOffset, formatGap,
  averageSpm, openSheet, toast,
} from "./core.js";
import { boatLabel } from "./handicap.js";

const CLUB = "Club Colonia Rowing";

export const SHARE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;

// El logo se carga de entrada (está en el cache offline): al compartir,
// la imagen se arma al instante, sin perder el toque del usuario que
// iOS exige para abrir el menú de compartir.
const logo = new Image();
logo.src = "assets/logo-wordmark.png";


// =============================
// DATOS COMUNES
// =============================

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// "Pasada 2" = segunda pasada de ese día (si no tiene nombre de trabajo)
export function pasadaNumber(entry) {
  return history.list()
    .filter((e) => e.type === "pasada" && sameDay(e.date, entry.date) && e.date <= entry.date)
    .length;
}

export function entryTitle(entry) {
  if (entry.type === "entreno") return "Entreno";
  return entry.name ? entry.name : `Pasada ${pasadaNumber(entry)}`;
}

// 01:52.4 → 1:52.4 (en un mensaje o una planilla el cero de adelante sobra)
function clock(ms) {
  return formatClock(ms).replace(/^0(?=\d:)/, "");
}

function dateLabel(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "numeric" });
  return day.replace(/\.$/, "").replace(/^./, (c) => c.toUpperCase());
}

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// SPM medidos durante la pasada: [26, 28] → "26 · 28 spm"
export function spmText(readings) {
  if (!readings || !readings.length) return "";
  return `${readings.map((r) => r.spm).join(" · ")} spm`;
}

function spmAverage(readings) {
  if (!readings || !readings.length) return null;
  return Math.round(readings.reduce((s, r) => s + r.spm, 0) / readings.length);
}

// Lo más viejo primero: así se lee el día en orden
function chronological(entries) {
  return [...entries].sort((a, b) => a.date - b.date);
}

function fileStamp(entries) {
  const d = new Date(chronological(entries)[0].date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}


// =============================
// MENSAJE (WhatsApp)
// =============================

function pasadaText(entry) {
  const lines = [`*${entryTitle(entry)}* · ${entry.distance} m · ${timeLabel(entry.date)}`];
  entry.results.forEach((r, i) => {
    const gap = r.gapMs > 0 ? ` (${formatGap(r.gapMs)})` : "";
    const spm = r.spm && r.spm.length ? ` · ${spmText(r.spm)}` : "";
    lines.push(`${i + 1}. *${r.name}* — ${clock(r.timeMs)}${gap}${spm}`);
    lines.push(`    ${boatLabel(r)} · salió ${formatOffset(r.offset)}`);
  });
  entry.missing.forEach((b) => {
    lines.push(`–  ${b.name}: sin llegada`);
  });
  return lines.join("\n");
}

function entrenoText(entry) {
  const avg = averageSpm(entry.samples);
  const parts = [formatDuration(entry.durationMs / 1000)];
  if (entry.laps.length) parts.push(`${entry.laps.length} ${entry.laps.length === 1 ? "vuelta" : "vueltas"}`);
  if (avg !== null) parts.push(`${avg} spm prom.`);
  const lines = [`*Entreno* · ${timeLabel(entry.date)}`, `⏱ ${parts.join(" · ")}`];
  entry.laps.forEach((lap, i) => {
    const spm = lap.avgSpm !== null && lap.avgSpm !== undefined ? ` · ${lap.avgSpm} spm` : "";
    lines.push(`${i + 1}. ${clock(lap.split)}${spm}`);
  });
  return lines.join("\n");
}

export function entriesText(entries) {
  const sorted = chronological(entries);
  const blocks = [];
  let day = null;
  sorted.forEach((e) => {
    const label = dateLabel(e.date);
    if (label !== day) {
      blocks.push(`📅 *${label}*`);
      day = label;
    }
    blocks.push(e.type === "entreno" ? entrenoText(e) : pasadaText(e));
  });
  return `🚣 *${CLUB}*\n\n${blocks.join("\n\n")}`;
}


// =============================
// IMAGEN (tarjeta PNG)
// =============================
// Se dibuja en un canvas de 1080 px de ancho (lo que usan WhatsApp e
// Instagram). Fondo claro para que el logo azul del club se vea bien.

const W = 1080;
const PAD = 64;
const INK = "#16213a";
const MUTED = "#5b6478";
const BLUE = "#274a9c";
const LINE = "#e3e7ef";

function font(weight, size, family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif") {
  return `${weight} ${size}px ${family}`;
}
const NUM = "Oswald, -apple-system, sans-serif";

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

// Cada bloque devuelve su alto y se dibuja con draw(ctx, y)
function headerBlock(entries) {
  const days = [...new Set(chronological(entries).map((e) => dateLabel(e.date)))];
  return {
    h: 190,
    draw(ctx, y) {
      const logoH = 96;
      if (logo.complete && logo.naturalWidth) {
        const logoW = logo.naturalWidth * (logoH / logo.naturalHeight);
        ctx.drawImage(logo, PAD, y + 40, logoW, logoH);
      }
      ctx.fillStyle = INK;
      ctx.font = font(700, 44);
      ctx.fillText(CLUB, PAD + 180, y + 86);
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 32);
      ctx.fillText(days.join(" · "), PAD + 180, y + 130);
    },
  };
}

function titleBlock(entry) {
  const sub = entry.type === "entreno"
    ? timeLabel(entry.date)
    : `${entry.distance} m · ${timeLabel(entry.date)}`;
  return {
    h: 112,
    draw(ctx, y) {
      ctx.fillStyle = LINE;
      ctx.fillRect(PAD, y + 16, W - PAD * 2, 3);
      ctx.fillStyle = BLUE;
      ctx.font = font(800, 42);
      ctx.fillText(fitText(ctx, entryTitle(entry), W - PAD * 2 - 260), PAD, y + 82);
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 32);
      ctx.textAlign = "right";
      ctx.fillText(sub, W - PAD, y + 82);
      ctx.textAlign = "left";
    },
  };
}

function resultBlock(r, pos) {
  return {
    h: 104,
    draw(ctx, y) {
      const mid = y + 52;
      ctx.fillStyle = MUTED;
      ctx.font = font(600, 34, NUM);
      ctx.fillText(pos, PAD, mid + 12);

      ctx.fillStyle = r.color || BLUE;
      ctx.beginPath();
      ctx.arc(PAD + 62, mid, 13, 0, Math.PI * 2);
      ctx.fill();

      const textX = PAD + 96;
      const right = W - PAD;
      ctx.textAlign = "right";
      ctx.fillStyle = r.timeMs === undefined ? MUTED : INK;
      ctx.font = r.timeMs === undefined ? font(500, 30) : font(600, 46, NUM);
      const time = r.timeMs === undefined ? "Sin llegada" : clock(r.timeMs);
      ctx.fillText(time, right, mid + 4);
      const timeW = ctx.measureText(time).width;
      if (r.gapMs > 0) {
        ctx.fillStyle = MUTED;
        ctx.font = font(500, 26);
        ctx.fillText(formatGap(r.gapMs), right, mid + 40);
      }
      ctx.textAlign = "left";

      const maxW = right - textX - Math.max(timeW, 150) - 24;
      ctx.fillStyle = INK;
      ctx.font = font(700, 36);
      ctx.fillText(fitText(ctx, r.name, maxW), textX, mid - 4);
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 26);
      const spm = spmText(r.spm);
      const sub = r.timeMs === undefined
        ? boatLabel(r)
        : `${boatLabel(r)} · salió ${formatOffset(r.offset)}${spm ? ` · ${spm}` : ""}`;
      ctx.fillText(fitText(ctx, sub, maxW), textX, mid + 34);
    },
  };
}

function statsBlock(entry) {
  const avg = averageSpm(entry.samples);
  const stats = [
    [formatDuration(entry.durationMs / 1000), "Duración"],
    [String(entry.laps.length), "Vueltas"],
    [avg === null ? "–" : String(avg), "SPM prom."],
  ];
  return {
    h: 170,
    draw(ctx, y) {
      const gap = 20;
      const w = (W - PAD * 2 - gap * 2) / 3;
      stats.forEach(([value, label], i) => {
        const x = PAD + i * (w + gap);
        ctx.fillStyle = "#f1f4f9";
        roundRect(ctx, x, y + 16, w, 136, 24);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = INK;
        ctx.font = font(600, 56, NUM);
        ctx.fillText(value, x + w / 2, y + 90);
        ctx.fillStyle = MUTED;
        ctx.font = font(500, 26);
        ctx.fillText(label, x + w / 2, y + 128);
        ctx.textAlign = "left";
      });
    },
  };
}

function chartBlock(entry) {
  const points = entry.samples;
  return {
    h: 260,
    draw(ctx, y) {
      const values = points.map((p) => p.spm);
      let min = Math.min(...values);
      let max = Math.max(...values);
      if (max - min < 6) {
        const m = (max + min) / 2;
        min = m - 3;
        max = m + 3;
      }
      const left = PAD + 56;
      const top = y + 30;
      const w = W - PAD - left;
      const h = 190;
      const duration = entry.durationMs / 1000 || 1;
      const xy = (p) => [left + (p.t / duration) * w, top + (1 - (p.spm - min) / (max - min)) * h];

      ctx.fillStyle = MUTED;
      ctx.font = font(500, 24, NUM);
      ctx.textAlign = "right";
      ctx.fillText(Math.round(max), left - 14, top + 10);
      ctx.fillText(Math.round(min), left - 14, top + h);
      ctx.textAlign = "left";

      ctx.beginPath();
      points.forEach((p, i) => {
        const [x, py] = xy(p);
        if (i === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      });
      ctx.strokeStyle = "#2f9e5b";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.stroke();
    },
  };
}

function lapBlock(lap, i) {
  return {
    h: 64,
    draw(ctx, y) {
      const mid = y + 42;
      ctx.fillStyle = MUTED;
      ctx.font = font(600, 30, NUM);
      ctx.fillText(String(i + 1), PAD, mid);
      ctx.fillStyle = INK;
      ctx.font = font(600, 38, NUM);
      ctx.fillText(clock(lap.split), PAD + 70, mid);
      ctx.textAlign = "right";
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 28);
      ctx.fillText(clock(lap.total), W - PAD, mid);
      ctx.fillStyle = "#2f9e5b";
      ctx.font = font(600, 34, NUM);
      ctx.fillText(lap.avgSpm === null || lap.avgSpm === undefined ? "–" : `${lap.avgSpm} spm`, W - PAD - 190, mid);
      ctx.textAlign = "left";
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function imageBlocks(entries) {
  const blocks = [headerBlock(entries)];
  chronological(entries).forEach((e) => {
    blocks.push(titleBlock(e));
    if (e.type === "entreno") {
      blocks.push(statsBlock(e));
      if (e.samples.length >= 2) blocks.push(chartBlock(e));
      e.laps.forEach((lap, i) => blocks.push(lapBlock(lap, i)));
    } else {
      e.results.forEach((r, i) => blocks.push(resultBlock(r, String(i + 1))));
      e.missing.forEach((b) => blocks.push(resultBlock(b, "–")));
    }
  });
  return blocks;
}

function dataUrlToBlob(dataUrl) {
  const [head, data] = dataUrl.split(",");
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: head.match(/:(.*?);/)[1] });
}

export function entriesImage(entries) {
  const blocks = imageBlocks(entries);
  const footer = 90;
  const height = blocks.reduce((s, b) => s + b.h, 0) + footer;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, W, 14);

  let y = 0;
  blocks.forEach((b) => {
    b.draw(ctx, y);
    y += b.h;
  });

  ctx.fillStyle = MUTED;
  ctx.font = font(500, 24);
  ctx.textAlign = "center";
  ctx.fillText("SPM Tracker · @clubcoloniarowing", W / 2, height - 36);

  // toDataURL es sincrónico (toBlob no): el menú de compartir se abre
  // dentro del mismo toque, como pide Safari.
  return dataUrlToBlob(canvas.toDataURL("image/png"));
}


// =============================
// PLANILLA (.xlsx)
// =============================
// Un .xlsx es un zip con unos XML adentro. Se arma a mano (sin librerías,
// para que funcione offline): una hoja "Pasadas" con una fila por bote y
// otra "Entrenos" con una fila por vuelta. Los tiempos van como texto
// "1:52.4" para leerlos, y además en segundos como número para calcular.

function xmlEscape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetXml(header, rows, widths) {
  const cell = (v, r, c, style = 0) => {
    const ref = `${colName(c)}${r}`;
    const s = style ? ` s="${style}"` : "";
    if (v === null || v === undefined || v === "") return `<c r="${ref}"${s}/>`;
    if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t>${xmlEscape(v)}</t></is></c>`;
  };
  const rowXml = (values, r, style) => `<row r="${r}">${values.map((v, c) => cell(v, r, c, style)).join("")}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rowXml(header, 1, 1)}${rows.map((row, i) => rowXml(row, i + 2, 0)).join("")}</sheetData>
</worksheet>`;
}

function dateCell(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const secs = (ms) => Math.round(ms / 100) / 10;

function pasadaRows(entries) {
  const rows = [];
  entries.filter((e) => e.type === "pasada").forEach((e) => {
    const boatRow = (b, pos) => [
      dateCell(e.date), timeLabel(e.date), entryTitle(e), e.distance, pos,
      b.name, b.boatClass, b.category, b.gender, formatOffset(b.offset),
      b.timeMs === undefined ? "Sin llegada" : clock(b.timeMs),
      b.timeMs === undefined ? null : secs(b.timeMs),
      b.timeMs === undefined ? null : secs(b.gapMs),
      spmAverage(b.spm), b.spm && b.spm.length ? b.spm.map((r) => r.spm).join(" · ") : "",
    ];
    e.results.forEach((r, i) => rows.push(boatRow(r, i + 1)));
    e.missing.forEach((b) => rows.push(boatRow(b, null)));
  });
  return rows;
}

function entrenoRows(entries) {
  const rows = [];
  entries.filter((e) => e.type === "entreno").forEach((e) => {
    const base = [dateCell(e.date), timeLabel(e.date), formatDuration(e.durationMs / 1000), averageSpm(e.samples)];
    if (!e.laps.length) {
      rows.push([...base, null, "", null, null, ""]);
      return;
    }
    e.laps.forEach((lap, i) => {
      rows.push([...base, i + 1, clock(lap.split), secs(lap.split), lap.avgSpm ?? null, clock(lap.total)]);
    });
  });
  return rows;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Zip sin compresión (método "stored"): suficiente para unos pocos KB
function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  files.forEach(({ name, content }) => {
    const nameBytes = enc.encode(name);
    const data = enc.encode(content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(local, nameBytes, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);
    central.push(dir, nameBytes);

    offset += 30 + nameBytes.length + data.length;
  });

  const centralSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function entriesXlsx(entries) {
  const sorted = chronological(entries);
  const sheets = [];
  const pasadas = pasadaRows(sorted);
  const entrenos = entrenoRows(sorted);
  if (pasadas.length) {
    sheets.push({
      name: "Pasadas",
      xml: sheetXml(
        ["Fecha", "Hora", "Trabajo", "Distancia (m)", "Puesto", "Bote", "Tipo", "Categoría", "Rama",
          "Salida", "Tiempo", "Tiempo (s)", "Diferencia (s)", "SPM prom.", "SPM medidos"],
        pasadas,
        [11, 7, 20, 12, 8, 20, 6, 12, 6, 8, 10, 10, 13, 10, 16],
      ),
    });
  }
  if (entrenos.length || !sheets.length) {
    sheets.push({
      name: "Entrenos",
      xml: sheetXml(
        ["Fecha", "Hora", "Duración", "SPM prom.", "Vuelta", "Parcial", "Parcial (s)", "SPM vuelta", "Total"],
        entrenos,
        [11, 7, 10, 10, 8, 10, 11, 11, 10],
      ),
    });
  }

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF274A9C"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: s.xml })),
  ];
  return zip(files);
}


// =============================
// ENVIAR (menú de compartir del celular)
// =============================

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function shareFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // el usuario cerró el menú
    }
  }
  // Sin menú de compartir (computadora, o Android con planillas):
  // se descarga y desde Archivos / Descargas se abre o se manda.
  download(blob, filename);
  toast("Descargado en el celular");
}

async function shareText(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiado: pegalo en WhatsApp");
  } catch (err) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
}

// Planilla de todo lo elegido, sin pasar por la hoja de opciones
export function shareXlsx(entries) {
  shareFile(entriesXlsx(entries), `CCR historial ${fileStamp(entries)}.xlsx`, CLUB);
}

// Hoja con las tres opciones. onBack: para volver a la hoja de donde vino.
export function openShareSheet(entries, { onBack = null } = {}) {
  if (!entries.length) return;
  const count = entries.length;
  const what = count > 1 ? `${count} sesiones`
    : entries[0].type === "entreno" ? "este entreno" : `"${entryTitle(entries[0])}"`;
  const name = `CCR ${fileStamp(entries)}`;

  const box = openSheet({
    title: "Compartir",
    onBack,
    content: `
      <p class="sheet-message">Mandá ${escapeHtml(what)} por WhatsApp, mail o guardalo en Drive.</p>
      <div class="list share-list">
        <button type="button" class="share-row" data-share="text">
          <span class="share-icon text">💬</span>
          <span class="boat-text">
            <span class="boat-name">Mensaje</span>
            <span class="boat-sub">Texto con los tiempos, para el grupo</span>
          </span>
          <span class="chevron">›</span>
        </button>
        <button type="button" class="share-row" data-share="image">
          <span class="share-icon image">🖼️</span>
          <span class="boat-text">
            <span class="boat-name">Imagen</span>
            <span class="boat-sub">Tarjeta con el logo del club</span>
          </span>
          <span class="chevron">›</span>
        </button>
        <button type="button" class="share-row" data-share="xlsx">
          <span class="share-icon xlsx">📊</span>
          <span class="boat-text">
            <span class="boat-name">Planilla</span>
            <span class="boat-sub">Excel o Google Sheets, para el registro</span>
          </span>
          <span class="chevron">›</span>
        </button>
      </div>
      <p class="footnote">Se arma sin conexión. Si no hay señal, WhatsApp lo manda cuando vuelva.</p>`,
  });

  box.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-share]");
    if (!btn) return;
    const kind = btn.dataset.share;
    if (kind === "text") shareText(entriesText(entries));
    else if (kind === "image") shareFile(entriesImage(entries), `${name}.png`, CLUB);
    else shareFile(entriesXlsx(entries), `${name}.xlsx`, CLUB);
  });
}
