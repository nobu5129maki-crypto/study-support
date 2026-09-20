/**
 * 掛け算の * を × に、割り算の / を ÷ に揃える（教科書・問題用紙に近い表記）。
 * 日付 YYYY/MM/DD、URL、単位（km/h、m/s など）はそのまま残す。
 */

const PH_START = "\uE0DC";
const PH_END = "\uE0DD";

/** そのまま残したい部分（日付・URL・単位）をプレースホルダに退避する */
function protectLiterals(text: string): { s: string; saved: string[] } {
  const saved: string[] = [];
  const keep = (m: string) => {
    saved.push(m);
    return `${PH_START}${saved.length - 1}${PH_END}`;
  };
  let s = text;
  // URL
  s = s.replace(/https?:\/\/[^\s）)」』】]+/g, keep);
  // 日付 YYYY/MM/DD
  s = s.replace(/\b(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/g, keep);
  // 単位の組み合わせ（km/h, m/s, g/cm³, 円/個, m/秒 など）
  // 左右どちらかが「単位として使われる記号」であればそのまま残す
  const unitToken =
    "(?:km|cm|mm|nm|m|kg|mg|g|t|L|mL|dL|kL|h|min|s|sec|ms|N|J|W|kW|kWh|Wh|Pa|hPa|kPa|Hz|kHz|MHz|mol|cal|kcal|A|V|Ω|C|K|rad|deg|ha|a|ppm|人|円|個|回|匹|台|枚|本|冊|秒|分|時間|時|日|年|月|週|世帯|km²|m²|cm²|km³|m³|cm³|㎡|㎥|㎢)";
  // 後読み（lookbehind）は古い iOS Safari で未対応のため、直前の1文字をキャプチャして残す
  const unitRe = new RegExp(
    `(^|[^A-Za-z0-9\\u3040-\\u30ff\\u4e00-\\u9fff])(${unitToken}(?:[²³]|\\^[23])?\\s*\\/\\s*${unitToken}(?:[²³]|\\^[23])?)(?![A-Za-z0-9\\u3040-\\u30ff\\u4e00-\\u9fff])`,
    "gu"
  );
  s = s.replace(unitRe, (_, pre: string, unit: string) => pre + keep(unit));
  return { s, saved };
}

function restoreLiterals(s: string, saved: string[]): string {
  return s.replace(
    new RegExp(`${PH_START}(\\d+)${PH_END}`, "g"),
    (_, i) => saved[Number(i)] ?? _
  );
}

/**
 * ASCII の * を × に（数字・変数・括弧の間の * のみ）
 */
function asteriskToTimes(s: string): string {
  // 前後の空白はそのまま残す（"2 * 3" → "2 × 3"）
  const re =
    /([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√²³)\]}])(\s*)\*(\s*)([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√(\[{])/gu;
  let out = s;
  for (let i = 0; i < 20; i++) {
    const next = out.replace(re, "$1$2×$3$4");
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * 割り算の / を ÷ に（日付・URL・単位は protectLiterals 済み）
 */
function slashToDivide(s: string): string {
  let out = s;

  // 前後の空白はそのまま残す（"16 / 4" → "16 ÷ 4"）
  const digitSlash =
    /\b(\d+(?:\.\d+)?)(\s*)\/(\s*)(\d+(?:\.\d+)?)\b/g;
  for (let i = 0; i < 15; i++) {
    const next = out.replace(digitSlash, "$1$2÷$3$4");
    if (next === out) break;
    out = next;
  }

  const alnumSlash =
    /([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω²³]+(?:\.[0-9０-９]+)?)(\s*)\/(\s*)([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω]+(?:\.[0-9０-９]+)?)/gu;
  for (let i = 0; i < 15; i++) {
    const next = out.replace(alnumSlash, "$1$2÷$3$4");
    if (next === out) break;
    out = next;
  }

  return out;
}

export function normalizeMathSymbols(text: string): string {
  if (!text) return text;
  const { s: withPlaceholders, saved } = protectLiterals(text);
  let s = asteriskToTimes(withPlaceholders);
  s = slashToDivide(s);
  return restoreLiterals(s, saved);
}
