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
if (strlen($rawBody) > 8000000) {
    study_json(413, array('error' => '画像サイズが大きすぎます。撮影枠を小さくするか、もう一度撮影してください。'));
}

$body = json_decode($rawBody, true);
$image = is_array($body) && isset($body['image']) && is_string($body['image']) ? $body['image'] : '';
if ($image === '') {
    study_json(400, array('error' => '画像が送信されていません'));
}

$mime = 'image/jpeg';
if (preg_match('#^data:(image/[a-zA-Z0-9.+-]+);base64,#', $image, $mimeMatch)) {
    $candidate = strtolower($mimeMatch[1]);
    if (in_array($candidate, array('image/jpeg', 'image/png', 'image/webp', 'image/gif'), true)) {
        $mime = $candidate;
    }
}
$base64 = preg_replace('#^data:image/[a-zA-Z0-9.+-]+;base64,#', '', $image);
if (!is_string($base64) || $base64 === '') {
    study_json(400, array('error' => '画像が送信されていません'));
}
$decoded = base64_decode($base64, true);
if ($decoded === false || $decoded === '' || strlen($decoded) > 8000000) {
    study_json(400, array('error' => '画像が送信されていません'));
}

$apiKey = study_api_key();
if ($apiKey === '') {
    study_json(500, array('error' => 'GEMINI_API_KEY が設定されていません'));
}

$prompt = <<<'TXT'
この画像に写っている問題・課題の内容を読み取って、以下のJSON形式で答えてください。
{
  "problem": "問題文や課題の内容をそのままテキストで",
  "subject": "数学|国語|英語|理科|社会|その他 のいずれか"
}

【重要な指示】
- 数学・数式の場合：数式、方程式、グラフ、図形などは正確に読み取り、累乗は a^b、ルートは √(x) のように表記してください。掛け算は×、割り算は÷（半角*や式の半角/は使わない）。分数だけは a/b の形でもよい。横に長く書かれた式も省略せず全文を転記してください。
- 横長の文章や数式は改行せず、元の並び順を保ってください。
- 画像が読み取れない、問題が写っていない場合は problem を空文字にしてください。
TXT;

$contents = array(
    array(
        'role' => 'user',
        'parts' => array(
            array(
                'inlineData' => array(
                    'mimeType' => $mime,
                    'data' => $base64,
                ),
            ),
            array('text' => $prompt),
        ),
    ),
);

$result = study_generate($apiKey, $contents, '', 2048);
if (empty($result['ok'])) {
    study_json(
        isset($result['status']) ? (int) $result['status'] : 502,
        array('error' => isset($result['error']) ? $result['error'] : '解析中にエラーが発生しました')
    );
}

$content = $result['text'];
$parsed = array();
$jsonOk = false;
if (preg_match('/\{[\s\S]*\}/u', $content, $match)) {
    $decodedJson = json_decode($match[0], true);
    if (is_array($decodedJson)) {
        $parsed = $decodedJson;
        $jsonOk = true;
    }
}
if (!$jsonOk) {
    $parsed = array('problem' => $content, 'subject' => 'その他');
}

$problemText = study_normalize_math(trim(isset($parsed['problem']) && is_string($parsed['problem']) ? $parsed['problem'] : ''));
$subject = isset($parsed['subject']) && is_string($parsed['subject']) && $parsed['subject'] !== '' ? $parsed['subject'] : 'その他';
if ($problemText === '') {
    study_json(400, array('error' => '問題を読み取れませんでした。もう一度撮影してください。'));
}

study_json(200, array(
    'sessionId' => bin2hex(random_bytes(16)),
    'problemText' => $problemText,
    'subject' => $subject,
));
