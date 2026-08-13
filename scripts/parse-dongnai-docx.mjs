/**
 * Probe / parse Đồng Nai NQ 28/2025 .docx phụ lục files in uploads/dong-nai.
 * Usage: node scripts/parse-dongnai-docx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../uploads/dong-nai");
const OUT = path.join(__dirname, "../data/land-prices-dongnai.json");

function decodeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function cellText(tcXml) {
  const parts = [];
  // Must not match w:tc / w:tcPr / w:tr — only bare <w:t> or <w:t ...>
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(tcXml))) parts.push(decodeXml(m[1]));
  return parts.join("").replace(/\s+/g, " ").trim();
}

function extractTables(xml) {
  const tables = [];
  const tblRe = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
  let tm;
  while ((tm = tblRe.exec(xml))) {
    const rows = [];
    const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
    let tr;
    while ((tr = trRe.exec(tm[0]))) {
      const cells = [];
      const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      let tc;
      while ((tc = tcRe.exec(tr[0]))) cells.push(cellText(tc[0]));
      if (cells.some((c) => c)) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function extractParagraphs(xml) {
  const paras = [];
  const pRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pm;
  while ((pm = pRe.exec(xml))) {
    const t = cellText(pm[0]); // reuse cellText for w:t
    if (t) paras.push(t);
  }
  return paras;
}

async function readDocx(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("word/document.xml");
  if (!f) return { tables: [], paras: [] };
  const xml = await f.async("string");
  return { tables: extractTables(xml), paras: extractParagraphs(xml) };
}

function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).replace(/\./g, "").replace(/\s+/g, "").replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

function isStt(s) {
  return /^\d{1,4}(?:\.\d{1,2})?$/.test(String(s || "").trim());
}

function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function searchOf(...parts) {
  return norm(parts.join(" ")).toLowerCase();
}

function looksLikeWardHeader(line) {
  return /^(Phường|Xã|Thị trấn)\s+/i.test(line) || /^\d+\.\s*(Phường|Xã)/i.test(line);
}

function cleanWardName(line) {
  return norm(line.replace(/^\d+\.\s*/, ""));
}

/** Parse PL-III style tables: STT | street | from | to | residential | commercial | production */
function parsePl3FromDoc(doc, fallbackWard = "") {
  const rows = [];
  let ward = fallbackWard;

  // Scan paras for ward titles between tables — also scan first cell patterns
  // Walk all tables; detect ward from preceding paras by reconstructing document order is hard.
  // Strategy: iterate tables; if a row looks like a single-cell ward header use it;
  // otherwise parse data rows. Also scan paras for "Phường/Xã" near table index.

  const wardParas = doc.paras.filter(
    (p) =>
      looksLikeWardHeader(p) &&
      !/Phụ lục|BẢNG GIÁ|Đơn vị|Ban hành/i.test(p) &&
      p.length < 80,
  );

  let wardIdx = 0;
  if (!ward && wardParas[0]) ward = cleanWardName(wardParas[0]);

  for (const table of doc.tables) {
    // Heuristic: if first data-ish row has only 1-2 short cells naming ward
    for (const cells of table) {
      if (cells.length === 1 && looksLikeWardHeader(cells[0])) {
        ward = cleanWardName(cells[0]);
        continue;
      }
      const sttRaw = cells[0];
      if (!isStt(sttRaw)) {
        // maybe header row
        if (cells.some((c) => /Điểm đầu|Tên đường|Giá đất/i.test(c))) continue;
        // ward in first column spanning?
        if (looksLikeWardHeader(sttRaw) && cells.length <= 2) {
          ward = cleanWardName(sttRaw);
        }
        continue;
      }

      // Layout A: stt, street, from, to, res, com, prod  (7 cols)
      // Layout B: stt, street, from, to, res, com, prod with đoạn merged
      // Layout C (Bình Phước style): stt, street, from, to under Đoạn đường, prices — still 7
      let street = "";
      let from = "";
      let to = "";
      let residential = null;
      let commercial = null;
      let production = null;

      if (cells.length >= 7) {
        street = cells[1];
        from = cells[2];
        to = cells[3];
        residential = parsePrice(cells[4]);
        commercial = parsePrice(cells[5]);
        production = parsePrice(cells[6]);
      } else if (cells.length === 6) {
        street = cells[1];
        from = cells[2];
        to = cells[3];
        residential = parsePrice(cells[4]);
        commercial = parsePrice(cells[5]);
        production = null;
      } else if (cells.length === 5) {
        street = cells[1];
        from = "";
        to = "";
        residential = parsePrice(cells[2]);
        commercial = parsePrice(cells[3]);
        production = parsePrice(cells[4]);
      } else {
        continue;
      }

      if (residential == null && commercial == null) continue;
      if (!street) continue;

      // Advance ward from para list when stt resets to 1
      if (Number(sttRaw) === 1 && wardIdx + 1 < wardParas.length) {
        // keep current unless empty
      }
      if (!ward && wardParas[wardIdx]) ward = cleanWardName(wardParas[wardIdx]);

      const stt = Number(sttRaw);
      rows.push({
        region: ward || "—",
        stt: Number.isFinite(stt) ? stt : null,
        sttLabel: String(sttRaw),
        street: norm(street),
        from: norm(from),
        to: norm(to),
        residential,
        commercial,
        production,
        searchText: searchOf(ward, street, from, to),
      });
    }
    // after each table, maybe next ward
    if (wardIdx + 1 < wardParas.length) {
      // only bump when we saw stt restart — handled loosely below
    }
  }

  // Better ward assignment: re-walk with para stream
  return assignWardsFromParas(doc, rows.length ? rows : parsePl3Loose(doc));
}

function parsePl3Loose(doc) {
  // fallback unused
  return [];
}

/**
 * Re-parse PL-III with paragraph+table interleaved approach:
 * Split document.xml into sequential blocks of p and tbl.
 */
async function parsePl3File(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");

  const blocks = [];
  const re = /(<w:tbl[\s>][\s\S]*?<\/w:tbl>)|(<w:p[\s>][\s\S]*?<\/w:p>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const rows = [];
      const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
      let tr;
      while ((tr = trRe.exec(m[1]))) {
        const cells = [];
        const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
        let tc;
        while ((tc = tcRe.exec(tr[0]))) cells.push(cellText(tc[0]));
        if (cells.some((c) => c)) rows.push(cells);
      }
      blocks.push({ type: "table", rows });
    } else if (m[2]) {
      const t = cellText(m[2]);
      if (t) blocks.push({ type: "p", text: t });
    }
  }

  const out = [];
  let ward = "";
  for (const b of blocks) {
    if (b.type === "p") {
      const t = b.text;
      if (
        looksLikeWardHeader(t) &&
        !/Phụ lục|BẢNG GIÁ|Đơn vị|Ban hành|Nghị quyết/i.test(t) &&
        t.length < 100
      ) {
        ward = cleanWardName(t.replace(/^\d+\.\s*/, ""));
      }
      continue;
    }
    for (const cells of b.rows) {
      if (cells.length === 1 && looksLikeWardHeader(cells[0])) {
        ward = cleanWardName(cells[0]);
        continue;
      }
      const sttRaw = cells[0];
      if (!isStt(sttRaw)) continue;

      let street, from, to, residential, commercial, production;
      if (cells.length >= 7) {
        [, street, from, to] = cells;
        residential = parsePrice(cells[4]);
        commercial = parsePrice(cells[5]);
        production = parsePrice(cells[6]);
      } else if (cells.length === 5) {
        street = cells[1];
        from = "";
        to = "";
        residential = parsePrice(cells[2]);
        commercial = parsePrice(cells[3]);
        production = parsePrice(cells[4]);
      } else if (cells.length === 6) {
        street = cells[1];
        from = cells[2];
        to = cells[3];
        residential = parsePrice(cells[4]);
        commercial = parsePrice(cells[5]);
        production = null;
      } else continue;

      if (!street || (residential == null && commercial == null)) continue;
      const stt = Number(sttRaw);
      out.push({
        region: ward || "—",
        stt: Number.isFinite(stt) ? stt : null,
        sttLabel: String(sttRaw),
        street: norm(street),
        from: norm(from),
        to: norm(to),
        residential,
        commercial,
        production,
        searchText: searchOf(ward, street, from, to),
      });
    }
  }
  return out;
}

/** PL-I: stt, street, from, to, perennial/annual price, forest/aqua price (or 6-7 cols with split) */
async function parsePl1File(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");
  const blocks = [];
  const re = /(<w:tbl[\s>][\s\S]*?<\/w:tbl>)|(<w:p[\s>][\s\S]*?<\/w:p>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const rows = [];
      const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
      let tr;
      while ((tr = trRe.exec(m[1]))) {
        const cells = [];
        const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
        let tc;
        while ((tc = tcRe.exec(tr[0]))) cells.push(cellText(tc[0]));
        if (cells.some((c) => c)) rows.push(cells);
      }
      blocks.push({ type: "table", rows });
    } else if (m[2]) {
      const t = cellText(m[2]);
      if (t) blocks.push({ type: "p", text: t });
    }
  }

  const out = [];
  let ward = "";
  for (const b of blocks) {
    if (b.type === "p") {
      if (
        looksLikeWardHeader(b.text) &&
        !/Phụ lục|BẢNG GIÁ|Đơn vị|Ban hành/i.test(b.text) &&
        b.text.length < 100
      ) {
        ward = cleanWardName(b.text.replace(/^\d+\.\s*/, ""));
      }
      continue;
    }
    for (const cells of b.rows) {
      const sttRaw = cells[0];
      if (!isStt(sttRaw)) continue;
      // common: stt, street, from, to, cropPrice, forestAquaPrice
      // or stt, street, from, to, perennial, annual, aqua
      let street = cells[1] || "";
      let from = "";
      let to = "";
      let perennial = null;
      let annual = null;
      let aquaculture = null;
      let forest = null;

      if (cells.length >= 7) {
        from = cells[2];
        to = cells[3];
        perennial = parsePrice(cells[4]);
        annual = parsePrice(cells[5]);
        aquaculture = parsePrice(cells[6]);
        forest = cells[7] != null ? parsePrice(cells[7]) : null;
      } else if (cells.length >= 6) {
        from = cells[2];
        to = cells[3];
        perennial = parsePrice(cells[4]);
        annual = perennial;
        forest = parsePrice(cells[5]);
        aquaculture = forest;
      } else if (cells.length === 5) {
        from = cells[2];
        to = cells[3];
        perennial = parsePrice(cells[4]);
        annual = perennial;
      } else continue;

      if (!street || perennial == null) continue;
      const stt = Number(sttRaw);
      out.push({
        region: ward || "—",
        stt: Number.isFinite(stt) ? stt : null,
        sttLabel: String(sttRaw),
        street: norm(street),
        from: norm(from),
        to: norm(to),
        perennial,
        annual,
        aquaculture,
        forest,
        searchText: searchOf(ward, street, from, to),
      });
    }
  }
  return out;
}

async function parsePl4File(filePath) {
  const doc = await readDocx(filePath);
  const rows = [];
  let group = "Khu công nghiệp";
  for (const table of doc.tables) {
    for (const cells of table) {
      const a = cells[0] || "";
      if (/^I$/.test(a) || /Khu công nghiệp/i.test(cells.join(" "))) {
        group = "Khu công nghiệp";
        if (!isStt(a)) continue;
      }
      if (/^II$/.test(a) || /Cụm công nghiệp/i.test(cells.join(" "))) {
        group = "Cụm công nghiệp";
        if (!isStt(a)) continue;
      }
      if (!isStt(a)) continue;
      const name = cells[1] || "";
      const location = cells[2] || "";
      const price = parsePrice(cells[3]);
      if (!name || price == null) continue;
      rows.push({
        group,
        stt: Number(a),
        sttLabel: String(a),
        name: norm(name),
        location: norm(location),
        region: norm(location),
        price,
        searchText: searchOf(group, name, location),
      });
    }
  }
  return rows;
}

async function parsePl6File(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");
  const blocks = [];
  const re = /(<w:tbl[\s>][\s\S]*?<\/w:tbl>)|(<w:p[\s>][\s\S]*?<\/w:p>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const rows = [];
      const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
      let tr;
      while ((tr = trRe.exec(m[1]))) {
        const cells = [];
        const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
        let tc;
        while ((tc = tcRe.exec(tr[0]))) cells.push(cellText(tc[0]));
        if (cells.some((c) => c)) rows.push(cells);
      }
      blocks.push({ type: "table", rows });
    } else if (m[2]) {
      const t = cellText(m[2]);
      if (t) blocks.push({ type: "p", text: t });
    }
  }

  const out = [];
  let region = "";
  let currentZone = "";
  let stt = null;
  for (const b of blocks) {
    if (b.type === "p") {
      if (
        looksLikeWardHeader(b.text) &&
        !/Phụ lục|BẢNG GIÁ|Đơn vị/i.test(b.text) &&
        b.text.length < 80
      ) {
        region = cleanWardName(b.text);
      }
      continue;
    }
    for (const cells of b.rows) {
      if (cells.length === 1 && looksLikeWardHeader(cells[0])) {
        region = cleanWardName(cells[0]);
        continue;
      }
      // PL-VI often: TT | zone name | street | price  OR TT spanning multiple street rows
      if (isStt(cells[0])) {
        stt = Number(cells[0]);
        if (cells.length >= 4) {
          currentZone = cells[1];
          const street = cells[2];
          const price = parsePrice(cells[3]);
          if (price != null) {
            out.push({
              region: region || "—",
              stt,
              sttLabel: String(cells[0]),
              name: norm(currentZone),
              street: norm(street),
              price,
              searchText: searchOf(region, currentZone, street),
            });
          }
        } else if (cells.length === 3) {
          currentZone = cells[1];
          const price = parsePrice(cells[2]);
          if (price != null) {
            out.push({
              region: region || "—",
              stt,
              sttLabel: String(cells[0]),
              name: norm(currentZone),
              street: "",
              price,
              searchText: searchOf(region, currentZone),
            });
          }
        }
      } else if (cells.length >= 2 && currentZone) {
        // continuation street rows without STT
        const street = cells[0] || cells[1];
        const price = parsePrice(cells[cells.length - 1]);
        if (price != null && street && !/Giá đất|Tên/i.test(street)) {
          out.push({
            region: region || "—",
            stt,
            sttLabel: stt != null ? String(stt) : "",
            name: norm(currentZone),
            street: norm(street),
            price,
            searchText: searchOf(region, currentZone, street),
          });
        }
      }
    }
  }
  return out;
}

async function parsePl8File(filePath) {
  const doc = await readDocx(filePath);
  const allRows = doc.tables.flat();
  // Find two sections: min then max
  const dataRows = allRows.filter((c) => isStt(c[0]) && c.length >= 5);
  // First half-ish min, second max — detect by "tối đa" in paras
  const maxMarker = doc.paras.findIndex((p) => /tối đa/i.test(p));
  // Simpler: collect all, first occurrence of stt=1 starts min, second stt=1 starts max
  const minMap = new Map();
  const maxMap = new Map();
  let mode = "min";
  let sawStt1 = false;
  for (const cells of dataRows) {
    const stt = Number(cells[0]);
    if (stt === 1) {
      if (sawStt1) mode = "max";
      sawStt1 = true;
    }
    const name = cells[1];
    const perennial = parsePrice(cells[2]);
    const annual = parsePrice(cells[3]);
    const aquaculture = parsePrice(cells[4]);
    const forest = cells[5] != null && cells[5] !== "" ? parsePrice(cells[5]) : null;
    const rec = { stt, name, perennial, annual, aquaculture, forest };
    if (mode === "min") minMap.set(stt, rec);
    else maxMap.set(stt, rec);
  }

  const rows = [];
  for (const [stt, mn] of minMap) {
    const mx = maxMap.get(stt) || {};
    rows.push({
      stt,
      sttLabel: String(stt),
      region: norm(mn.name),
      name: norm(mn.name),
      perennialMin: mn.perennial,
      annualMin: mn.annual,
      aquacultureMin: mn.aquaculture,
      forestMin: mn.forest,
      perennialMax: mx.perennial ?? null,
      annualMax: mx.annual ?? null,
      aquacultureMax: mx.aquaculture ?? null,
      forestMax: mx.forest ?? null,
      searchText: searchOf(mn.name),
    });
  }
  return rows;
}

function assignWardsFromParas(doc, rows) {
  return rows;
}

function emptyAppendix(key, title, layout, sourceUrl) {
  return {
    key,
    title,
    layout,
    unit: "1000đ/m²",
    sourceUrl,
    regions: [],
    rows: [],
  };
}

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /\.docx$/i.test(f))
    .sort();
  console.error("Found docx:", files.join(", "));

  // Map by content / known names
  const pl3Files = ["28-2025-nq-6.docx", "28-2025-nq-7.docx", "28-2025-nq-8.docx"]
    .map((f) => path.join(DIR, f))
    .filter((f) => fs.existsSync(f));
  const pl1Files = ["28-2025-nq-2.docx", "28-2025-nq-3.docx", "28-2025-nq-4.docx"]
    .map((f) => path.join(DIR, f))
    .filter((f) => fs.existsSync(f));
  const pl4File = path.join(DIR, "28-2025-nq-9.docx");
  const pl6File = path.join(DIR, "28-2025-nq-11.docx");
  const pl8File = path.join(DIR, "28-2025-nq-13.docx");

  console.error("Parsing PL-III...");
  let pl3Rows = [];
  for (const f of pl3Files) {
    const rows = await parsePl3File(f);
    console.error(`  ${path.basename(f)}: ${rows.length} rows`);
    pl3Rows = pl3Rows.concat(rows);
  }

  console.error("Parsing PL-I...");
  let pl1Rows = [];
  for (const f of pl1Files) {
    const rows = await parsePl1File(f);
    console.error(`  ${path.basename(f)}: ${rows.length} rows`);
    pl1Rows = pl1Rows.concat(rows);
  }

  console.error("Parsing PL-IV...");
  const pl4Rows = fs.existsSync(pl4File) ? await parsePl4File(pl4File) : [];
  console.error(`  pl4: ${pl4Rows.length}`);

  console.error("Parsing PL-VI...");
  const pl6Rows = fs.existsSync(pl6File) ? await parsePl6File(pl6File) : [];
  console.error(`  pl6: ${pl6Rows.length}`);

  console.error("Parsing PL-VIII...");
  const pl8Rows = fs.existsSync(pl8File) ? await parsePl8File(pl8File) : [];
  console.error(`  pl8: ${pl8Rows.length}`);

  const regionsOf = (rows, key = "region") => [
    ...new Set(rows.map((r) => r[key]).filter(Boolean)),
  ];

  const appendices = {
    pl3: {
      key: "pl3",
      title:
        "Phụ lục III — Bảng giá đất phi nông nghiệp theo tuyến đường",
      layout: "hcm-like",
      unit: "1000đ/m²",
      sourceUrl:
        "https://talai.dongnai.gov.vn/vi/van-ban/detail/NGhi-quyet-Quy-dinh-Bang-gia-dat-lan-dau-tren-dia-ban-tinh-Dong-Nai-nam-2026-66/",
      sourceFiles: pl3Files.map((f) => path.basename(f)),
      regions: regionsOf(pl3Rows),
      rows: pl3Rows,
    },
    pl4: {
      key: "pl4",
      title:
        "Phụ lục IV — Bảng giá đất các khu công nghiệp, cụm công nghiệp",
      layout: "industrial",
      unit: "1000đ/m²",
      sourceUrl:
        "https://cdn.thuvienphapluat.vn/phap-luat/2022-2/THN/PL-IV-NQ-28.pdf",
      sourceFiles: fs.existsSync(pl4File) ? [path.basename(pl4File)] : [],
      regions: regionsOf(pl4Rows, "location"),
      rows: pl4Rows,
    },
    pl6: {
      key: "pl6",
      title: "Phụ lục VI — Bảng giá đất các khu tái định cư",
      layout: "resettlement",
      unit: "1000đ/m²",
      sourceUrl:
        "https://cdn.thuvienphapluat.vn/uploads/danluat///FileAttack/TT/19788/NQ%20So%20%2028-2025-HDND-%20Kem%20Phu%20luc%20VI.pdf",
      sourceFiles: fs.existsSync(pl6File) ? [path.basename(pl6File)] : [],
      regions: regionsOf(pl6Rows),
      rows: pl6Rows,
    },
    pl8: {
      key: "pl8",
      title:
        "Phụ lục VIII — Giá đất nông nghiệp tối thiểu và tối đa",
      layout: "agri-minmax",
      unit: "1000đ/m²",
      sourceUrl:
        "https://cdn.thuvienphapluat.vn/phap-luat/2022-2/THN/PL-VIII-NQ-28.pdf",
      sourceFiles: fs.existsSync(pl8File) ? [path.basename(pl8File)] : [],
      regions: regionsOf(pl8Rows),
      rows: pl8Rows,
    },
    pl1: {
      key: "pl1",
      title: "Phụ lục I — Bảng giá các loại đất nông nghiệp",
      layout: "agriculture",
      unit: "1000đ/m²",
      sourceUrl:
        "https://talai.dongnai.gov.vn/vi/van-ban/detail/NGhi-quyet-Quy-dinh-Bang-gia-dat-lan-dau-tren-dia-ban-tinh-Dong-Nai-nam-2026-66/",
      sourceFiles: pl1Files.map((f) => path.basename(f)),
      regions: regionsOf(pl1Rows),
      rows: pl1Rows,
    },
  };

  const totalRows = Object.values(appendices).reduce(
    (s, a) => s + a.rows.length,
    0,
  );
  const defaultAppendix = pl3Rows.length
    ? "pl3"
    : pl4Rows.length
      ? "pl4"
      : "pl8";

  const payload = {
    meta: {
      city: "dongnai",
      title: "Bảng giá đất tỉnh Đồng Nai",
      resolution: "Nghị quyết số 28/2025/NQ-HĐND",
      unit: "1000đ/m²",
      layout: "dongnai-multi",
      defaultAppendix,
      sourceUrl:
        "https://talai.dongnai.gov.vn/vi/van-ban/detail/NGhi-quyet-Quy-dinh-Bang-gia-dat-lan-dau-tren-dia-ban-tinh-Dong-Nai-nam-2026-66/",
      parsedAt: new Date().toISOString(),
      totalRows,
      totalRegions: 0,
      totalPages: 0,
    },
    appendices,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.error(
    `Wrote ${OUT} total=${totalRows} pl3=${pl3Rows.length} pl1=${pl1Rows.length} pl4=${pl4Rows.length} pl6=${pl6Rows.length} pl8=${pl8Rows.length}`,
  );
  if (pl3Rows[0]) console.error("Sample PL3:", JSON.stringify(pl3Rows[0], null, 2));
  if (pl6Rows[0]) console.error("Sample PL6:", JSON.stringify(pl6Rows[0], null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
