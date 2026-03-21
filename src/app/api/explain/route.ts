import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenAI } from "@/lib/google-genai";
import { normalizeMathSymbols } from "@/lib/mathNotation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionPayload = {
  problemText: string;
  subject: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  stepIndex: number;
  difficultyLevel: number;
};

const DIFFICULTY_PROMPTS: Record<number, string> = {
  0: "標準的な説明で、専門用語は必要に応じて使ってください。",
  1: "中学生でも理解できるように、やや易しい言葉で説明してください。専門用語は簡単な言葉に言い換えてください。",
  2: "小学生高学年でも理解できるように、とても易しい言葉で、具体例を多く使って説明してください。",
};

function buildSystemInstruction(data: SessionPayload): string {
  const diff = DIFFICULTY_PROMPTS[data.difficultyLevel] ?? DIFFICULTY_PROMPTS[0];
  const mathSpecific =
    data.subject === "数学"
      ? `
【数学・数式の解説ルール】
- 数式は7x+5、(7x+5)のようにそのまま書いてください。$や\(\)で囲まないこと。
- 掛け算は必ず「×」を使ってください（半角*は使わない）。割り算は必ず「÷」を使ってください（式の割り算に半角/は使わない）。
- 分数だけは「2/3」のようにスラッシュ表記してもよい。それ以外の割り算は÷で書く。
- 数式は1行ずつ丁寧に展開し、各変形の理由を簡潔に添えてください。
- 累乗、ルートは読みやすい形で表記（例：x²、√2）。
- 横長の式は途中で改行せず、1行で書ける範囲で示してください。
- 「まず〜を確認」「次に〜を計算」のように順序立てて説明してください。`
      : "";

  return `あなたは優しい家庭教師です。${data.subject}の質問に答えます。

【全科目共通・段階的解説（最優先）】
- いきなり「最終答え」「正解」「結論」「完成した答案」は出さない。特に最初の数回の返答では、答え・正しい選択肢・計算結果の数値・作文の全文などを述べない。
- 選択問題：最初から「答えは○番」「正解は〜」と言わない。まず問題の読み方・与えられた条件の整理・考え方の第1歩だけ。
- 計算・式・証明：最終結果や答えの数値を初回ステップで書かない。読み取り・式の立て方・最初の変形の1つだけなどにとどめる。
- 国語（読解・文法・漢字など）：一気に解説し尽くさない。段落の意味・語句の見方・設問の狙いの一部だけなど、今ステップの範囲だけ。
- 英語（文法・長文・英作文など）：訳文全文・模範解答の全文を一度に出さない。文の構造の一部・語句の意味・第1文の読み方などから始める。
- 理科・社会：結論だけや暗記答案の羅列を最初に出さない。図・グラフ・資料の読み取り・用語の確認・思考の第1歩から。
- 解説は必ず1ステップずつ。まだ続きがあるうちは【解答完了】を絶対に書かない。
- 各ステップの最後は「ここまで理解できたかな？」などで区切る。

【重要なルール】
1. 数学では数式は7x+5、(7x+5)、x²のようにそのまま書く。掛け算は×、割り算は÷（*や式中の/は使わない）。LaTeX記法（ドル記号やバックスラッシュ括弧で囲む形式）は使わない。数学以外で数式が出る場合も同様に、LaTeXは使わない。
2. 上記「全科目共通」と矛盾するなら、常に「段階的・答えを出さない」を優先する。
3. 解説が完全に終わり、すべての設問の答えが出揃ったときだけ、説明の最後に必ず【解答完了】とだけ書く。途中のステップでは【解答完了】を書かない。
4. 説明のトーンは${diff}
5. 回答は日本語で、今のステップに必要な分だけ簡潔に。${mathSpecific}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      problemText?: string;
      subject?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      stepIndex?: number;
      difficultyLevel?: number;
      action?: "next" | "simplify";
    };
    const {
      sessionId,
      problemText,
      subject,
      messages = [],
      stepIndex = 0,
      difficultyLevel = 0,
      action = "next",
    } = body;

    if (!problemText || !subject) {
      return NextResponse.json(
        { error: "問題のデータが読み込めませんでした。ホームからもう一度問題を撮影してください。" },
        { status: 404 }
      );
    }

    const problemTextNorm = normalizeMathSymbols(problemText.trim());

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const ai = await createGoogleGenAI(process.env.GEMINI_API_KEY);

    const session: SessionPayload = {
      problemText: problemTextNorm,
      subject,
      messages,
      stepIndex,
      difficultyLevel: action === "simplify" ? Math.min(2, difficultyLevel + 1) : difficultyLevel,
    };

    const userContent =
      stepIndex === 0
        ? "【今回の範囲】最初のステップだけにしてください。問題の読み取り・条件整理・考え方の第1歩まで。最終答え・正解・数値の結果・選択肢の断定・作文の全文などはまだ出さないでください。"
        : action === "simplify"
          ? "前の説明が難しかったようなので、もっと易しい言葉で同じ内容を説明し直してください。いきなり答えや結論だけを出さないでください。"
          : "前のステップは理解できたとのことなので、次の1ステップだけ説明してください。まだ途中なら最終答えや【解答完了】は出さないでください。";

    const historyContents = session.messages.map((m) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const noLatexNote = session.subject === "数学" ? "\n【重要】数式は7x、(7x+5)のようにそのまま書いてください。ドル記号で囲まないでください。" : "";
    const currentUserContent = `【問題】
${session.problemText}

この問題を、全科目共通ルールに従い1ステップずつ解説してください。いきなり答えを出さないこと。${userContent}${noLatexNote}`;

    const contents = [
      ...historyContents,
      {
        role: "user" as const,
        parts: [{ text: currentUserContent }],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: buildSystemInstruction(session),
        // 短すぎると解説が文の途中で切れるため十分な余裕を確保
        maxOutputTokens: 8192,
      },
    });

    let content = response.text ?? "";
    // LaTeX記法を完全除去
    const L = "\uE001", R = "\uE002";
    content = content.replace(/&#36;/g, "$").replace(/\\\(/g, L).replace(/\\\)/g, R);
    for (let i = 0; i < 10; i++) {
      const prev = content;
      content = content
        .replace(/\$+([^$]*?)\$+/g, "$1")
        .replace(new RegExp(L + "([\\s\\S]*?)" + R, "g"), "$1");
      if (content === prev) break;
    }
    content = content.replace(/[\$＄﹩\u0024\uFF04\uFE69]/g, "");
    content = normalizeMathSymbols(content);
    const isComplete = content.includes("【解答完了】");
    const cleanContent = content.replace(/【解答完了】/g, "").trim();

    const newStepIndex = action === "simplify" ? stepIndex : stepIndex + 1;
    const newDifficultyLevel = session.difficultyLevel;

    return NextResponse.json({
      explanation: cleanContent,
      isComplete,
      stepIndex: newStepIndex,
      difficultyLevel: newDifficultyLevel,
      // クライアントが次回リクエストで送るための更新済みメッセージ
      messages:
        action === "simplify"
          ? messages
          : [
              ...messages,
              {
                role: "user" as const,
                content: `この問題を、全科目共通ルールに従い1ステップずつ解説してください。いきなり答えを出さないこと。${userContent}`,
              },
              { role: "assistant" as const, content: content },
            ],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "解説の取得に失敗しました" },
      { status: 500 }
    );
  }
}
