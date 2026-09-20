import { normalizeMathSymbols } from "./mathNotation";

/**
 * AI の解説文を、プレーンテキスト表示用に整える。
 * - LaTeX 記法（$...$、\(...\)、\frac など）を除去
 * - Markdown 記法（**太字**、# 見出し、箸条書きの * / -、コードフェンス）を除去
 * - 掛け算・割り算記号を × ÷ に揃える
 * 画面側・API 側の両方から呼ぶ（冪等）。
 */

const L = "\uE001";
const R = "\uE002";

function stripLatex(text: string): string {
  let result = text
    .replace(/&#36;/g, "$")
    .replace(/\\\(/g, L)
    .replace(/\\\)/g, R)
    .replace(/\\\[/g, L)
    .replace(/\\\]/g, R);
  for (let i = 0; i < 10; i++) {
    const prev = result;
    result = result
      .replace(/\$+([^$]*?)\$+/g, "$1")
      .replace(new RegExp(L + "([\\s\\S]*?)" + R, "g"), "$1");
    if (result === prev) break;
  }
  // 単独で残ったプレースホルダ・$ を掃除
  result = result.replace(new RegExp(`[${L}${R}]`, "g"), "");
  result = result.replace(/[\$＄﹩\uFF04\uFE69]/g, "");
  // よく出る LaTeX コマンドを読みやすい記号に
  result = result
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, "×")
    .replace(/\\pm/g, "±")
    .replace(/\\le(?:q)?\b/g, "≦")
    .replace(/\\ge(?:q)?\b/g, "≧")
    .replace(/\\neq?\b/g, "≠")
    .replace(/\\pi\b/g, "π")
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\,|\\;|\\!|\\quad|\\qquad/g, " ");
  return result;
}

function stripMarkdown(text: string): string {
  let s = text;
  // コードフェンス ``` と インラインコード `
  s = s.replace(/```[a-zA-Z]*\n?/g, "").replace(/`([^`\n]*)`/g, "$1");
  // 見出し #, ##, ###
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  // 太字・斜体 ***text*** / **text** / __text__
  for (let i = 0; i < 5; i++) {
    const prev = s;
    s = s
      .replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1")
      .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
      .replace(/__([^_\n]+?)__/g, "$1");
    if (s === prev) break;
  }
  // 行頭の箇条書き * / - / + を「・」に
  s = s.replace(/^([ \t]*)[\*\-\+][ \t]+/gm, "$1・");
  // 水平線 ---
  s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "");
  // 残った太字用の ** （閉じ忘れなど）
  s = s.replace(/\*\*/g, "");
  // 3行以上の連続空行を2行に
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

export function cleanExplanation(text: string): string {
  if (!text) return text;
  let s = stripLatex(text);
  s = stripMarkdown(s);
  s = normalizeMathSymbols(s);
  return s.trim();
}
