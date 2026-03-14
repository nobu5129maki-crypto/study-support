export type SessionData = {
  problemText: string;
  subject: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  stepIndex: number;
  difficultyLevel: number; // 0=標準, 1=易しい, 2=とても易しい
  createdAt: number;
};

const sessions = new Map<string, SessionData>();

const EXPIRY_MS = 30 * 60 * 1000; // 30分

function cleanup() {
  const now = Date.now();
  for (const [id, data] of sessions.entries()) {
    if (now - data.createdAt > EXPIRY_MS) sessions.delete(id);
  }
}

export function createSession(problemText: string, subject: string): string {
  cleanup();
  const id = crypto.randomUUID();
  sessions.set(id, {
    problemText,
    subject,
    messages: [],
    stepIndex: 0,
    difficultyLevel: 0,
    createdAt: Date.now(),
  });
  return id;
}

export function getSession(id: string): SessionData | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  if (Date.now() - s.createdAt > EXPIRY_MS) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}

export function updateSession(
  id: string,
  updater: (data: SessionData) => void
): SessionData | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  updater(s);
  return s;
}
