import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGenAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey: key });
}

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
- 数式は1行ずつ丁寧に展開し、各変形の理由を簡潔に添えてください。
- 分数、累乗、ルートは読みやすい形で表記（例：x²、√2、2/3）。
- 横長の式は途中で改行せず、1行で書ける範囲で示してください。
- 「まず〜を確認」「次に〜を計算」のように順序立てて説明してください。`
      : "";

  return `あなたは優しい家庭教師です。${data.subject}の質問に答えます。

【重要なルール】
1. 数式は7x+5、(7x+5)、x²のようにそのまま書いてください。LaTeX記法（ドル記号やバックスラッシュ括弧で囲む形式）は絶対に使わないでください。
2. 解説は必ず1ステップずつ進めます。一度に全部説明しないでください。
3. 各ステップの最後に「ここまで理解できたかな？」と確認する形で終えてください。
4. 解説が完全に終わり、答えが出揃ったら、説明の最後に必ず【解答完了】とだけ書いてください。まだ解答の途中で次のステップがある場合は【解答完了】と書かないでください。
5. 説明は${diff}
6. 回答は日本語で、簡潔に。${mathSpecific}`;
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const ai = getGenAI();

    const session: SessionPayload = {
      problemText,
      subject,
      messages,
      stepIndex,
      difficultyLevel: action === "simplify" ? Math.min(2, difficultyLevel + 1) : difficultyLevel,
    };

    const userContent =
      stepIndex === 0
        ? "まず最初のステップから始めてください。"
        : action === "simplify"
          ? "前の説明が難しかったようなので、もっと易しい言葉で同じ内容を説明し直してください。"
          : "前のステップは理解できたとのことなので、次のステップを説明してください。";

    const historyContents = session.messages.map((m) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const noLatexNote = session.subject === "数学" ? "\n【重要】数式は7x、(7x+5)のようにそのまま書いてください。ドル記号で囲まないでください。" : "";
    const currentUserContent = `【問題】
${session.problemText}

この問題を、1ステップずつ解説してください。${userContent}${noLatexNote}`;

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
        maxOutputTokens: 1200,
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
                content: `この問題を、1ステップずつ解説してください。${userContent}`,
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
