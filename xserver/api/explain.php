<?php
ini_set('display_errors', '0');
@set_time_limit(180);

require dirname(__DIR__) . '/auth.php';
require __DIR__ . '/http.php';
require __DIR__ . '/text.php';
require __DIR__ . '/gemini.php';

if (!study_logged_in()) {
    study_json(401, array('error' => 'ログインしてください。'));
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    study_json(405, array('error' => 'Method Not Allowed'));
}

$rawBody = file_get_contents('php://input');
if (!is_string($rawBody)) {
    $rawBody = '';
}
if (strlen($rawBody) > 2000000) {
    study_json(413, array('error' => '送信データが大きすぎます。'));
}

$body = json_decode($rawBody, true);
if (!is_array($body)) {
    $body = array();
}

$problemText = isset($body['problemText']) && is_string($body['problemText']) ? trim($body['problemText']) : '';
$subject = isset($body['subject']) && is_string($body['subject']) ? trim($body['subject']) : '';
if ($problemText === '' || $subject === '') {
    study_json(404, array('error' => '問題のデータが読み込めませんでした。ホームからもう一度問題を撮影してください。'));
}
if (strlen($problemText) > 20000) {
    $problemText = substr($problemText, 0, 20000);
}
$problemText = study_normalize_math($problemText);

$action = isset($body['action']) && $body['action'] === 'simplify' ? 'simplify' : 'next';
$stepIndex = isset($body['stepIndex']) ? (int) $body['stepIndex'] : 0;
if ($stepIndex < 0) {
    $stepIndex = 0;
}
$difficultyLevel = isset($body['difficultyLevel']) ? (int) $body['difficultyLevel'] : 0;
if ($action === 'simplify') {
    $difficultyLevel = min(2, $difficultyLevel + 1);
}
if ($difficultyLevel < 0) {
    $difficultyLevel = 0;
}
if ($difficultyLevel > 2) {
    $difficultyLevel = 2;
}

$messages = array();
if (isset($body['messages']) && is_array($body['messages'])) {
    foreach ($body['messages'] as $message) {
        if (!is_array($message)) {
            continue;
        }
        $role = isset($message['role']) && $message['role'] === 'assistant' ? 'assistant' : 'user';
        $content = isset($message['content']) && is_string($message['content']) ? $message['content'] : '';
        if ($content === '') {
            continue;
        }
        if (strlen($content) > 20000) {
            $content = substr($content, 0, 20000);
        }
        $messages[] = array('role' => $role, 'content' => $content);
        if (count($messages) >= 40) {
            break;
        }
    }
}

$apiKey = study_api_key();
if ($apiKey === '') {
    study_json(500, array('error' => 'GEMINI_API_KEY が設定されていません'));
}

$difficultyPrompts = array(
    0 => '標準的な説明で、専門用語は必要に応じて使ってください。',
    1 => '中学生でも理解できるように、やや易しい言葉で説明してください。専門用語は簡単な言葉に言い換えてください。',
    2 => '小学生高学年でも理解できるように、とても易しい言葉で、具体例を多く使って説明してください。',
);
$diff = isset($difficultyPrompts[$difficultyLevel]) ? $difficultyPrompts[$difficultyLevel] : $difficultyPrompts[0];
$mathSpecific = '';
if ($subject === '数学') {
    $mathSpecific = <<<'TXT'

【数学・数式の解説ルール】
- 数式は7x+5、(7x+5)のようにそのまま書いてください。$や\(\)で囲まないこと。
- 掛け算は必ず「×」を使ってください（半角*は使わない）。割り算は必ず「÷」を使ってください（式の割り算に半角/は使わない）。
- 分数だけは「2/3」のようにスラッシュ表記してもよい。それ以外の割り算は÷で書く。
- 数式は1行ずつ丁寧に展開し、各変形の理由を簡潔に添えてください。
- 累乗、ルートは読みやすい形で表記（例：x²、√2）。
- 横長の式は途中で改行せず、1行で書ける範囲で示してください。
- 「まず〜を確認」「次に〜を計算」のように順序立てて説明してください。
TXT;
}

$system = "あなたは優しい家庭教師です。{$subject}の質問に答えます。

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
4. 説明のトーンは{$diff}
5. 回答は日本語で、今のステップに必要な分だけ簡潔に。
6. 出力はプレーンテキストのみ。Markdown記法（**太字**、# 見出し、行頭の * や - の箇条書き、`コード`、表）は使わない。箇条書きが必要なときは「・」または「1.」を使う。
7. 単位は km/h、m/s のように書いてよい（これは割り算ではなく単位）。{$mathSpecific}";

if ($stepIndex === 0) {
    $userContent = '【今回の範囲】最初のステップだけにしてください。問題の読み取り・条件整理・考え方の第1歩まで。最終答え・正解・数値の結果・選択肢の断定・作文の全文などはまだ出さないでください。';
} elseif ($action === 'simplify') {
    $userContent = '前の説明が難しかったようなので、もっと易しい言葉で同じ内容を説明し直してください。いきなり答えや結論だけを出さないでください。';
} else {
    $userContent = '前のステップは理解できたとのことなので、次の1ステップだけ説明してください。まだ途中なら最終答えや【解答完了】は出さないでください。';
}
$noLatexNote = $subject === '数学'
    ? "\n【重要】数式は7x、(7x+5)のようにそのまま書いてください。ドル記号で囲まないでください。"
    : '';
$currentUser = "【問題】\n{$problemText}\n\nこの問題を、全科目共通ルールに従い1ステップずつ解説してください。いきなり答えを出さないこと。{$userContent}{$noLatexNote}";

$contents = array();
foreach ($messages as $message) {
    $contents[] = array(
        'role' => $message['role'] === 'user' ? 'user' : 'model',
        'parts' => array(array('text' => $message['content'])),
    );
}
$contents[] = array(
    'role' => 'user',
    'parts' => array(array('text' => $currentUser)),
);

$result = study_generate($apiKey, $contents, $system, 8192);
if (empty($result['ok'])) {
    study_json(
        isset($result['status']) ? (int) $result['status'] : 502,
        array('error' => isset($result['error']) ? $result['error'] : '解説の取得に失敗しました')
    );
}

$rawContent = study_clean_explanation($result['text']);
if (trim($rawContent) === '') {
    study_json(502, array('error' => '解説を生成できませんでした。もう一度お試しください。'));
}
$isComplete = strpos($rawContent, '【解答完了】') !== false;
$cleanContent = trim(str_replace('【解答完了】', '', $rawContent));
$newStepIndex = $action === 'simplify' ? $stepIndex : $stepIndex + 1;

$storedUser = 'この問題を、全科目共通ルールに従い1ステップずつ解説してください。いきなり答えを出さないこと。' . $userContent;
$nextMessages = $action === 'simplify'
    ? $messages
    : array_merge($messages, array(
        array('role' => 'user', 'content' => $storedUser),
        array('role' => 'assistant', 'content' => $rawContent),
    ));

study_json(200, array(
    'explanation' => $cleanContent,
    'isComplete' => $isComplete,
    'stepIndex' => $newStepIndex,
    'difficultyLevel' => $difficultyLevel,
    'messages' => $nextMessages,
));
