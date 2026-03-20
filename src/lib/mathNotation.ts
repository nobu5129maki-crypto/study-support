/**
 * 掛け算の * を × に、割り算の / を ÷ に揃える（教科書・問題用紙に近い表記）。
 * 日付 YYYY/MM/DD はそのまま残す。
 */

const DATE_PLACEHOLDER = "\uE0DC";
const DATE_END = "\uE0DD";

function protectDates(text: string): { s: string; dates: string[] } {
  const dates: string[] = [];
  const s = text.replace(
    /\b(\d{4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/g,
    (m) => {
      dates.push(m);
      return `${DATE_PLACEHOLDER}${dates.length - 1}${DATE_END}`;
    }
  );
  return { s, dates };
}

function restoreDates(s: string, dates: string[]): string {
  return s.replace(
    new RegExp(`${DATE_PLACEHOLDER}(\\d+)${DATE_END}`, "g"),
    (_, i) => dates[Number(i)] ?? _
  );
}

/**
 * ASCII の * を × に（数字・変数・括弧の間の * のみ）
 */
function asteriskToTimes(s: string): string {
  const re =
    /([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√)\]}])\s*\*\s*([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√(\[{])/gu;
  let out = s;
  for (let i = 0; i < 20; i++) {
    const next = out.replace(re, "$1×$2");
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * 割り算の / を ÷ に（日付は protectDates 済み）
 */
function slashToDivide(s: string): string {
  let out = s;

  const digitSlash =
    /\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\b/g;
  for (let i = 0; i < 15; i++) {
    const next = out.replace(digitSlash, "$1÷$2");
    if (next === out) break;
    out = next;
  }

  const alnumSlash =
    /([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω]+(?:\.[0-9０-９]+)?)\s*\/\s*([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω]+(?:\.[0-9０-９]+)?)/gu;
  for (let i = 0; i < 15; i++) {
    const next = out.replace(alnumSlash, "$1÷$2");
    if (next === out) break;
    out = next;
  }

  return out;
}

export function normalizeMathSymbols(text: string): string {
  if (!text) return text;
  const { s: withPlaceholders, dates } = protectDates(text);
  let s = asteriskToTimes(withPlaceholders);
  s = slashToDivide(s);
  return restoreDates(s, dates);
}
