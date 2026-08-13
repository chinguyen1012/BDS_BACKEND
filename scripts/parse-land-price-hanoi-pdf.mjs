/**
 * Parse bảng giá đất Hà Nội (NQ 52/2025/NQ-HĐND).
 *
 * KV1–6: TT | Tên đường | Từ | Đến | Đất ở VT1–4 | TM-DV VT1–4 | SX-KD VT1–4
 * KV7–17: TT | Tên đường phố (gồm mô tả đoạn) | Đất ở VT1–4 | TM-DV VT1–4 | SX-KD VT1–4
 *          (không có cột Từ/Đến; STT có thể là 1.1, 1.2…)
 *
 * Usage: node scripts/parse-land-price-hanoi-pdf.mjs [pdfPath] [outPath]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath =
  process.argv[2] ??
  path.join(__dirname, "../uploads/bang-gia-dat-ha-noi.pdf");
const outPath =
  process.argv[3] ?? path.join(__dirname, "../data/land-prices-hanoi.json");

/** KV1–6: có cột Từ/Đến */
const COL_FROM_TO = {
  stt: [25, 50],
  street: [50, 155],
  from: [155, 235],
  to: [235, 315],
  r1: [315, 350],
  r2: [350, 390],
  r3: [390, 430],
  r4: [430, 475],
  c1: [475, 520],
  c2: [520, 560],
  c3: [560, 605],
  c4: [605, 650],
  p1: [650, 690],
  p2: [690, 735],
  p3: [735, 775],
  p4: [775, 840],
};

/** KV7+: không Từ/Đến — tên đường rộng tới trước cột giá */
const COL_STREET_ONLY = {
  stt: [25, 50],
  street: [50, 315],
  r1: [315, 350],
  r2: [350, 390],
  r3: [390, 445],
  r4: [445, 485],
  c1: [485, 525],
  c2: [525, 565],
  c3: [565, 610],
  c4: [610, 650],
  p1: [650, 690],
  p2: [690, 735],
  p3: [735, 775],
  p4: [775, 840],
};

const PRICE_KEYS = [
  "r1",
  "r2",
  "r3",
  "r4",
  "c1",
  "c2",
  "c3",
  "c4",
  "p1",
  "p2",
  "p3",
  "p4",
];

const HEADER_RE =
  /^(TT|Tên đường phố|Đoạn đường|Giá đất|Từ|Đến|VT[1-4]|Đơn vị tính|PHỤ LỤC|BẢNG GIÁ|Ban hành|dịch vụ|nghiệp không|Giá đất ở|Giá đất thương mại|Quốc lộ|Tỉnh lộ|Đường địa phương)$/i;

const BOILERPLATE_RE =
  /Ban hành|Nghị quyết|Hội đồng|Đơn vị tính|PHỤ LỤC|BẢNG GIÁ|…|\.{3,}|\/2025\/NQ/i;

function inBand(x, [a, b]) {
  return x >= a && x < b;
}

function colOf(x, COL) {
  for (const [k, band] of Object.entries(COL)) {
    if (inBand(x, band)) return k;
  }
  return null;
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Giữ nguyên số trong PDF (đơn vị: 1000đ/m²) — "96 249" → 96249 */
function parseAmount(raw) {
  const n = Number(String(raw).replace(/\s+/g, "").replace(/\./g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function isPriceToken(s) {
  return /^\d{1,3}(?:\s\d{3})+$/.test(s.trim()) || /^\d{4,}$/.test(s.trim());
}

/** STT nguyên (1, 23) hoặc thập phân (1.1, 7.2) */
function isSttToken(s, allowDecimal) {
  if (allowDecimal) return /^\d{1,4}(?:\.\d{1,2})?$/.test(s.trim());
  return /^\d{1,4}$/.test(s.trim());
}

function areaNumber(area) {
  const m = String(area || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function layoutOfArea(area) {
  return areaNumber(area) >= 7 ? "street-only" : "from-to";
}

async function loadPdfJs() {
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  return import(pathToFileURL(pdfjsPath).href);
}

function pageItems(content) {
  return content.items
    .filter((i) => typeof i.str === "string" && i.str.trim())
    .map((i) => ({
      str: i.str.trim(),
      x: i.transform[4],
      y: i.transform[5],
    }));
}

function extractArea(items) {
  const joined = items
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str)
    .join(" ");
  const m = joined.match(/BẢNG GIÁ ĐẤT KHU VỰC\s+(\d+)/i);
  if (!m) return null;
  const detail = joined.match(/\(Cho các[^)]*\)/i);
  return {
    area: `Khu vực ${m[1]}`,
    areaDetail: detail ? normalize(detail[0]) : "",
  };
}

function detectPageHasFromTo(items) {
  return items.some(
    (i) =>
      (i.str === "Từ" || i.str === "Đến") && i.x > 150 && i.x < 320,
  );
}

function groupPrices(priceItems, COL) {
  const groups = [];
  for (const it of priceItems) {
    const c = colOf(it.x, COL);
    let g = groups.find((pg) => Math.abs(pg.y - it.y) < 8);
    if (!g) {
      g = { y: it.y, values: {} };
      groups.push(g);
    }
    g.values[c] = it.str;
    g.y = (g.y + it.y) / 2;
  }
  return groups
    .filter((g) => Object.keys(g.values).length >= 4)
    .sort((a, b) => b.y - a.y);
}

function pickPrices(g) {
  const pick = (k) =>
    g.values[k] != null ? parseAmount(g.values[k]) : null;
  const residential = {
    vt1: pick("r1"),
    vt2: pick("r2"),
    vt3: pick("r3"),
    vt4: pick("r4"),
  };
  const commercial = {
    vt1: pick("c1"),
    vt2: pick("c2"),
    vt3: pick("c3"),
    vt4: pick("c4"),
  };
  const production = {
    vt1: pick("p1"),
    vt2: pick("p2"),
    vt3: pick("p3"),
    vt4: pick("p4"),
  };
  return { residential, commercial, production };
}

function assignNear(items, validGroups) {
  const map = new Map();
  for (const g of validGroups) map.set(g, []);
  for (const it of items) {
    let best = null;
    let bestDist = Infinity;
    for (const g of validGroups) {
      const d = Math.abs(it.y - g.y);
      if (d < bestDist) {
        bestDist = d;
        best = g;
      }
    }
    if (best && bestDist < 40) map.get(best).push(it);
  }
  return map;
}

function parsePageFromTo(items, area, areaDetail) {
  const COL = COL_FROM_TO;
  const vtHeader = items.find(
    (i) => i.str === "VT1" && inBand(i.x, COL.r1),
  );
  const dataTop = vtHeader ? vtHeader.y - 4 : 490;

  const usable = items.filter((i) => {
    if (i.y >= dataTop || i.y < 25) return false;
    if (HEADER_RE.test(i.str)) return false;
    if (BOILERPLATE_RE.test(i.str)) return false;
    if (/^\(\d\)$/.test(i.str)) return false;
    return true;
  });

  const sttAnchors = usable
    .filter((i) => inBand(i.x, COL.stt) && isSttToken(i.str, false))
    .map((i) => ({ stt: Number(i.str), sttLabel: i.str, y: i.y }))
    .sort((a, b) => b.y - a.y);

  if (!sttAnchors.length) return [];

  const rows = [];

  for (let i = 0; i < sttAnchors.length; i++) {
    const { stt, sttLabel, y: sttY } = sttAnchors[i];
    const prevY = i === 0 ? sttY + 70 : (sttAnchors[i - 1].y + sttY) / 2;
    const nextY =
      i === sttAnchors.length - 1
        ? sttY - 70
        : (sttY + sttAnchors[i + 1].y) / 2;

    const top = Math.max(prevY, nextY) + 18;
    const bottom = Math.min(prevY, nextY) - 6;

    const band = usable.filter((it) => {
      if (it.y > top || it.y < bottom) return false;
      if (
        inBand(it.x, COL.stt) &&
        isSttToken(it.str, false) &&
        Number(it.str) !== stt
      ) {
        return false;
      }
      let nearest = sttAnchors[0];
      let nearestDist = Math.abs(it.y - nearest.y);
      for (const a of sttAnchors) {
        const d = Math.abs(it.y - a.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = a;
        }
      }
      if (nearest.stt !== stt && nearestDist + 3 < Math.abs(it.y - sttY)) {
        return false;
      }
      return true;
    });

    const street = normalize(
      band
        .filter(
          (it) =>
            colOf(it.x, COL) === "street" && !BOILERPLATE_RE.test(it.str),
        )
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((it) => it.str)
        .join(" "),
    );

    const fromItems = band.filter(
      (it) => colOf(it.x, COL) === "from" && !BOILERPLATE_RE.test(it.str),
    );
    const toItems = band.filter(
      (it) => colOf(it.x, COL) === "to" && !BOILERPLATE_RE.test(it.str),
    );

    const priceItems = band.filter((it) => {
      const c = colOf(it.x, COL);
      return c && PRICE_KEYS.includes(c) && isPriceToken(it.str);
    });

    const validGroups = groupPrices(priceItems, COL);
    if (!street || !validGroups.length) continue;

    const fromMap = assignNear(fromItems, validGroups);
    const toMap = assignNear(toItems, validGroups);

    for (const g of validGroups) {
      const from = normalize(
        (fromMap.get(g) || [])
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .map((it) => it.str)
          .join(" "),
      );
      const to = normalize(
        (toMap.get(g) || [])
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .map((it) => it.str)
          .join(" "),
      );
      const { residential, commercial, production } = pickPrices(g);

      rows.push({
        area,
        areaDetail,
        layoutVariant: "from-to",
        stt,
        sttLabel,
        street,
        from,
        to,
        residential,
        commercial,
        production,
        residentialVt1: residential.vt1,
        searchText: normalize(
          `${area} ${street} ${from} ${to}`,
        ).toLowerCase(),
      });
    }
  }

  return rows;
}

/**
 * KV7+: mỗi dòng giá gắn STT (1, 1.1, 8…).
 * Tên đường = text cột street gần dòng giá; với STT con (1.1)
 * gắn thêm tiêu đề cha (1) nếu có.
 */
function parsePageStreetOnly(items, area, areaDetail) {
  const COL = COL_STREET_ONLY;
  const vtHeader = items.find(
    (i) => i.str === "VT1" && inBand(i.x, COL.r1),
  );
  const dataTop = vtHeader ? vtHeader.y - 4 : 490;

  const usable = items.filter((i) => {
    if (i.y >= dataTop || i.y < 25) return false;
    if (HEADER_RE.test(i.str)) return false;
    if (BOILERPLATE_RE.test(i.str)) return false;
    if (/^\(\d\)$/.test(i.str)) return false;
    // bỏ tiêu đề nhóm La Mã I, II, III…
    if (/^[IVX]+$/.test(i.str) && inBand(i.x, COL.stt)) return false;
    return true;
  });

  const sttAnchors = usable
    .filter((i) => inBand(i.x, COL.stt) && isSttToken(i.str, true))
    .map((i) => ({
      sttLabel: i.str,
      stt: Number(i.str),
      y: i.y,
    }))
    .sort((a, b) => b.y - a.y);

  if (!sttAnchors.length) return [];

  const rows = [];

  for (let i = 0; i < sttAnchors.length; i++) {
    const anchor = sttAnchors[i];
    const { sttLabel, stt, y: sttY } = anchor;
    const prevY = i === 0 ? sttY + 50 : (sttAnchors[i - 1].y + sttY) / 2;
    const nextY =
      i === sttAnchors.length - 1
        ? sttY - 50
        : (sttY + sttAnchors[i + 1].y) / 2;

    const top = Math.max(prevY, nextY) + 10;
    const bottom = Math.min(prevY, nextY) - 4;

    const band = usable.filter((it) => {
      if (it.y > top || it.y < bottom) return false;
      if (
        inBand(it.x, COL.stt) &&
        isSttToken(it.str, true) &&
        it.str !== sttLabel
      ) {
        return false;
      }
      let nearest = sttAnchors[0];
      let nearestDist = Math.abs(it.y - nearest.y);
      for (const a of sttAnchors) {
        const d = Math.abs(it.y - a.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = a;
        }
      }
      if (
        nearest.sttLabel !== sttLabel &&
        nearestDist + 3 < Math.abs(it.y - sttY)
      ) {
        return false;
      }
      return true;
    });

    const streetItems = band
      .filter(
        (it) =>
          colOf(it.x, COL) === "street" && !BOILERPLATE_RE.test(it.str),
      )
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const streetLocal = normalize(streetItems.map((it) => it.str).join(" "));

    const priceItems = band.filter((it) => {
      const c = colOf(it.x, COL);
      return c && PRICE_KEYS.includes(c) && isPriceToken(it.str);
    });

    const validGroups = groupPrices(priceItems, COL);

    // Parent tiêu đề không có giá — bỏ qua
    if (!validGroups.length) {
      continue;
    }

    // Một STT thường một nhóm giá; nếu nhiều thì lấy nhóm gần STT nhất
    validGroups.sort(
      (a, b) => Math.abs(a.y - sttY) - Math.abs(b.y - sttY),
    );
    const g = validGroups[0];

    // Đoạn mô tả gần dòng giá (không lấy cả text của hàng khác)
    const nearStreet = normalize(
      streetItems
        .filter((it) => Math.abs(it.y - g.y) < 28)
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((it) => it.str)
        .join(" "),
    );

    let street = nearStreet || streetLocal;
    if (!street) continue;

    const { residential, commercial, production } = pickPrices(g);

    rows.push({
      area,
      areaDetail,
      layoutVariant: "street-only",
      stt,
      sttLabel,
      street,
      from: "",
      to: "",
      residential,
      commercial,
      production,
      residentialVt1: residential.vt1,
      searchText: normalize(`${area} ${street}`).toLowerCase(),
    });
  }

  return rows;
}

function parsePage(items, area, areaDetail) {
  const preferred = layoutOfArea(area);
  const pageHasFromTo = detectPageHasFromTo(items);
  const layout =
    preferred === "street-only"
      ? "street-only"
      : pageHasFromTo
        ? "from-to"
        : preferred;

  if (layout === "street-only") {
    return parsePageStreetOnly(items, area, areaDetail);
  }
  return parsePageFromTo(items, area, areaDetail);
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    process.exit(1);
  }

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const totalPages = doc.numPages;
  process.stderr.write(`PDF pages: ${totalPages}\n`);

  const areasSet = new Map();
  const allRows = [];
  let currentArea = "";
  let currentDetail = "";

  for (let p = 1; p <= totalPages; p++) {
    if (p % 20 === 0 || p === 1) {
      process.stderr.write(`Parsing page ${p}/${totalPages}...\n`);
    }
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = pageItems(content);
    if (!items.length) continue;

    const areaInfo = extractArea(items);
    if (areaInfo) {
      currentArea = areaInfo.area;
      currentDetail = areaInfo.areaDetail;
      areasSet.set(currentArea, currentDetail);
    }
    if (!currentArea) continue;

    const hasTable = items.some(
      (i) => i.str === "VT1" || i.str === "VT4" || /^Đầu đường$/.test(i.str),
    );
    if (!hasTable) continue;

    allRows.push(...parsePage(items, currentArea, currentDetail));
  }

  const areas = [...areasSet.entries()]
    .map(([area, areaDetail]) => ({
      area,
      areaDetail,
      layoutVariant: layoutOfArea(area),
    }))
    .sort((a, b) => areaNumber(a.area) - areaNumber(b.area));

  const payload = {
    meta: {
      city: "hanoi",
      title: "Bảng giá đất TP. Hà Nội",
      sourceUrl:
        "https://cdn.thuvienphapluat.vn/Uploads/danluat/FileAttack/TT/19885/Nghị-quyết-52-2025-NQ-HĐND.pdf",
      resolution: "Nghị quyết số 52/2025/NQ-HĐND",
      unit: "1000đ/m²",
      layout: "hanoi-vt",
      note:
        "Khu vực 1–6 có cột Đoạn đường Từ/Đến; từ khu vực 7 chỉ còn cột Tên đường phố (mô tả đoạn nằm trong tên).",
      columns: [
        { key: "stt", label: "TT", no: 1 },
        { key: "street", label: "Tên đường phố", no: 2 },
        { key: "from", label: "Đoạn đường — Từ (KV1–6)", no: 3 },
        { key: "to", label: "Đoạn đường — Đến (KV1–6)", no: 4 },
        { key: "residential", label: "Giá đất ở (VT1–VT4)", no: 5 },
        {
          key: "commercial",
          label: "Giá đất thương mại, dịch vụ (VT1–VT4)",
          no: 6,
        },
        {
          key: "production",
          label:
            "Giá đất SX-KD phi NN không phải TM-DV (VT1–VT4)",
          no: 7,
        },
      ],
      parsedAt: new Date().toISOString(),
      totalRows: allRows.length,
      totalAreas: areas.length,
      totalPages,
    },
    areas,
    rows: allRows,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  process.stderr.write(
    `Wrote ${allRows.length} rows, ${areas.length} areas → ${outPath}\n`,
  );

  const kv1 = allRows.find((r) => r.area === "Khu vực 1" && r.stt === 57);
  const kv7 = allRows.filter((r) => r.area === "Khu vực 7").slice(0, 4);
  process.stderr.write(
    `Sample KV1#57:\n${JSON.stringify(kv1, null, 2)}\n`,
  );
  process.stderr.write(
    `Sample KV7:\n${JSON.stringify(kv7, null, 2)}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
