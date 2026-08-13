/**
 * Parse Phụ lục bảng giá đất TP.HCM theo đúng 7 cột PDF:
 * (1) STT (2) TÊN ĐƯỜNG (3) TỪ (4) ĐẾN (5) ĐẤT Ở (6) TM-DV (7) SX-KD
 *
 * Dùng tọa độ text item từ pdfjs-dist để ghép cột.
 * Usage: node scripts/parse-land-price-pdf.mjs [pdfPath] [outPath]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath =
  process.argv[2] ??
  path.join(__dirname, "../uploads/phu-luc-bang-gia-dat-tp-hcm.pdf");
const outPath =
  process.argv[3] ?? path.join(__dirname, "../data/land-prices-hcm.json");

/** Column x bands — calibrated from NQ 87/2025 PDF layout */
const COL = {
  stt: [40, 78],
  street: [78, 168],
  from: [168, 255],
  to: [255, 350],
  p1: [350, 410],
  p2: [410, 485],
  p3: [485, 580],
};

const HEADER_RE =
  /^(STT|TÊN ĐƯỜNG|ĐOẠN ĐƯỜNG|GIÁ ĐẤT|TỪ|ĐẾN|ĐẤT Ở|ĐẤT|THƯƠNG|MẠI DỊCH|VỤ|SẢN|XUẤT KINH|DOANH PHI|NÔNG|NGHIỆP|KHÔNG|PHẢI LÀ ĐẤT|Đơn vị tính|Phụ lục|Ban hành|\(\d\))$/i;

function inBand(x, [a, b]) {
  return x >= a && x < b;
}

function colOf(x) {
  if (inBand(x, COL.stt)) return "stt";
  if (inBand(x, COL.street)) return "street";
  if (inBand(x, COL.from)) return "from";
  if (inBand(x, COL.to)) return "to";
  if (inBand(x, COL.p1)) return "p1";
  if (inBand(x, COL.p2)) return "p2";
  if (inBand(x, COL.p3)) return "p3";
  return null;
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim();
}

function parseAmount(raw) {
  const n = Number(String(raw).replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function isPriceToken(s) {
  return /^\d{1,3}(?:\.\d{3})+$/.test(s.trim());
}

function isSttToken(s) {
  return /^\d{1,4}$/.test(s.trim());
}

async function loadPdfJs() {
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  return import(pathToFileURL(pdfjsPath).href);
}

function extractWard(pageItems) {
  const joined = pageItems
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str)
    .join(" ");
  const m = joined.match(
    /MỤC\s+\d+\s*:\s*BẢNG GIÁ ĐẤT\s+(PHƯỜNG|XÃ)\s+([A-ZÀ-Ỵ\s]+?)(?=\s+Đơn|\s+STT|\s+\d+\s+[A-ZÀ-Ỵ]|\s*$)/i,
  );
  if (!m) return null;
  // bỏ số trang footer bị dính vào tên phường
  return normalize(m[2]).replace(/\s+\d+$/, "");
}

function pageItems(content) {
  return content.items
    .filter((i) => typeof i.str === "string" && i.str.trim())
    .map((i) => ({
      str: i.str.trim(),
      x: i.transform[4],
      y: i.transform[5],
      w: i.width || 0,
    }));
}

/**
 * Build logical rows from a page using STT anchors + column bands.
 */
function parsePage(items, ward) {
  const usable = items.filter((i) => {
    if (HEADER_RE.test(i.str)) return false;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(i.str)) return false;
    if (/^\(\d\)$/.test(i.str)) return false;
    // footer page numbers alone near bottom
    if (isSttToken(i.str) && i.y < 40) return false;
    return true;
  });

  const sttAnchors = usable
    .filter((i) => inBand(i.x, COL.stt) && isSttToken(i.str))
    .map((i) => ({ stt: Number(i.str), y: i.y }))
    .sort((a, b) => b.y - a.y);

  if (!sttAnchors.length) return [];

  const rows = [];

  for (let i = 0; i < sttAnchors.length; i++) {
    const { stt, y: sttY } = sttAnchors[i];
    const prevY = i === 0 ? sttY + 90 : (sttAnchors[i - 1].y + sttY) / 2;
    const nextY =
      i === sttAnchors.length - 1
        ? sttY - 90
        : (sttY + sttAnchors[i + 1].y) / 2;

    // Pad nhẹ vì ô Từ/Đến nhiều dòng vượt midpoint giữa 2 STT
    const top = Math.max(prevY, nextY) + 22;
    const bottom = Math.min(prevY, nextY) - 8;

    const band = usable.filter((it) => {
      if (it.y > top || it.y < bottom) return false;
      if (inBand(it.x, COL.stt) && isSttToken(it.str) && Number(it.str) !== stt) {
        return false;
      }
      // nếu gần STT khác hơn STT hiện tại thì bỏ (tránh dính hàng trên/dưới)
      let nearestStt = sttAnchors[0];
      let nearestDist = Math.abs(it.y - nearestStt.y);
      for (const a of sttAnchors) {
        const d = Math.abs(it.y - a.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestStt = a;
        }
      }
      if (nearestStt.stt !== stt && nearestDist + 4 < Math.abs(it.y - sttY)) {
        return false;
      }
      return true;
    });

    const streetParts = band
      .filter((it) => colOf(it.x) === "street")
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((it) => it.str);
    const street = normalize(streetParts.join(" "));

    // Price triples: group p1/p2/p3 by nearby y
    const priceItems = band
      .filter((it) => ["p1", "p2", "p3"].includes(colOf(it.x)) && isPriceToken(it.str))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const priceGroups = [];
    for (const it of priceItems) {
      const c = colOf(it.x);
      let g = priceGroups.find((pg) => Math.abs(pg.y - it.y) < 10);
      if (!g) {
        g = { y: it.y, p1: null, p2: null, p3: null };
        priceGroups.push(g);
      }
      g[c] = it.str;
      g.y = (g.y + it.y) / 2;
    }

    // from/to fragments also by y
    const fromItems = band
      .filter((it) => colOf(it.x) === "from")
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const toItems = band
      .filter((it) => colOf(it.x) === "to")
      .sort((a, b) => b.y - a.y || a.x - b.x);

    if (!priceGroups.length) continue;

    // Gán mỗi mảnh Từ/Đến cho nhóm giá gần nhất (tránh dính đoạn)
    const assignNear = (items) => {
      const map = new Map();
      for (const g of priceGroups) map.set(g, []);
      for (const it of items) {
        let best = null;
        let bestDist = Infinity;
        for (const g of priceGroups) {
          const d = Math.abs(it.y - g.y);
          if (d < bestDist) {
            bestDist = d;
            best = g;
          }
        }
        if (best && bestDist < 36) map.get(best).push(it);
      }
      return map;
    };

    const fromMap = assignNear(fromItems);
    const toMap = assignNear(toItems);

    for (const g of priceGroups) {
      const fromParts = (fromMap.get(g) || [])
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((it) => it.str);
      const toParts = (toMap.get(g) || [])
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((it) => it.str);

      let from = normalize(fromParts.join(" "));
      let to = normalize(toParts.join(" "));

      if (/TRỌN\s*ĐƯỜNG/i.test(from) || /TRỌN\s*ĐƯỜNG/i.test(to)) {
        from = "TRỌN ĐƯỜNG";
        to = "";
      } else if (
        priceGroups.length === 1 &&
        band.some((it) => /TRỌN\s*ĐƯỜNG/i.test(it.str) && colOf(it.x) === "from")
      ) {
        from = "TRỌN ĐƯỜNG";
        to = "";
      }

      const residential = g.p1 ? parseAmount(g.p1) : null;
      const commercial = g.p2 ? parseAmount(g.p2) : null;
      const production = g.p3 ? parseAmount(g.p3) : null;

      if (residential == null && commercial == null && production == null) {
        continue;
      }

      rows.push({
        ward,
        stt,
        street,
        from,
        to,
        residential,
        commercial,
        production,
      });
    }
  }

  return rows;
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    process.exit(1);
  }

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    // silence standard font warning
    useSystemFonts: true,
  }).promise;

  const totalPages = doc.numPages;
  process.stderr.write(`PDF pages: ${totalPages}\n`);

  const wardsSet = new Set();
  const allRows = [];
  let currentWard = "";

  for (let p = 1; p <= totalPages; p++) {
    if (p % 50 === 0 || p === 1) {
      process.stderr.write(`Parsing page ${p}/${totalPages}...\n`);
    }
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = pageItems(content);

    const ward = extractWard(items);
    if (ward) {
      currentWard = ward;
      wardsSet.add(ward);
    }
    if (!currentWard) continue;

    // skip phụ lục I (pages without table columns)
    const hasCols = items.some(
      (i) => i.str === "(1)" || i.str === "(5)" || i.str === "TRỌN ĐƯỜNG",
    );
    if (!hasCols && p < 6) continue;

    const rows = parsePage(items, currentWard);
    allRows.push(...rows);
  }

  // drop empty street rows
  const rows = allRows
    .filter((r) => r.street && (r.residential != null || r.commercial != null))
    .map((r) => ({
      ward: r.ward,
      stt: r.stt,
      street: r.street,
      from: r.from || "",
      to: r.to || "",
      residential: r.residential,
      commercial: r.commercial,
      production: r.production,
      searchText: normalize(
        `${r.ward} ${r.street} ${r.from || ""} ${r.to || ""}`,
      ).toLowerCase(),
    }));

  const wards = [...wardsSet].sort((a, b) => a.localeCompare(b, "vi"));

  const payload = {
    meta: {
      title: "Bảng giá đất TP. Hồ Chí Minh",
      sourceUrl:
        "https://cdn.thuvienphapluat.vn/uploads/danluat///FileAttack/TT/20040/phu-luc-bang-gia-dat-tp-hcm.pdf",
      resolution: "Nghị quyết số 87/2025/NQ-HĐND ngày 26/12/2025",
      unit: "1000đ/m²",
      columns: [
        { key: "stt", label: "STT", no: 1 },
        { key: "street", label: "Tên đường", no: 2 },
        { key: "from", label: "Đoạn đường — Từ", no: 3 },
        { key: "to", label: "Đoạn đường — Đến", no: 4 },
        { key: "residential", label: "Đất ở", no: 5 },
        { key: "commercial", label: "Đất thương mại dịch vụ", no: 6 },
        {
          key: "production",
          label:
            "Đất sản xuất kinh doanh phi nông nghiệp không phải là đất thương mại dịch vụ",
          no: 7,
        },
      ],
      parsedAt: new Date().toISOString(),
      totalRows: rows.length,
      totalWards: wards.length,
      totalPages,
    },
    wards,
    rows,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  process.stderr.write(
    `Wrote ${rows.length} rows, ${wards.length} wards → ${outPath}\n`,
  );

  // sanity sample
  const sample = rows.filter((r) => r.ward === "SÀI GÒN").slice(0, 8);
  process.stderr.write(`Sample SÀI GÒN:\n${JSON.stringify(sample, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
