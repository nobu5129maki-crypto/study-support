<?php

function study_api_key()
{
    $path = '/home/xs519923/xs519923.xsrv.jp/config.php';
    if (!is_file($path)) {
        return '';
    }
    $real = realpath($path);
    if (!is_string($real) || $real === '') {
        return '';
    }
    $norm = str_replace('\\', '/', $real);
    if (preg_match('#/public_html(/|$)#', $norm)) {
        return '';
    }
    if (basename($norm) !== 'config.php') {
        return '';
    }
    $level = ob_get_level();
    ob_start();
    try {
        $config = include $real;
    } catch (Exception $e) {
        $config = null;
    } catch (Throwable $e) {
        $config = null;
    }
    while (ob_get_level() > $level) {
        ob_end_clean();
    }
    if (!is_array($config) || !isset($config['GEMINI_API_KEY']) || !is_string($config['GEMINI_API_KEY'])) {
        return '';
    }
    return trim($config['GEMINI_API_KEY']);
}

function study_error_message($data)
{
    if (is_array($data) && isset($data['error']['message']) && is_string($data['error']['message'])) {
        return $data['error']['message'];
    }
    if (is_array($data) && isset($data['message']) && is_string($data['message'])) {
        return $data['message'];
    }
    return '';
}

function study_response_text($data)
{
    if (!is_array($data) || !isset($data['candidates'][0]['content']['parts']) || !is_array($data['candidates'][0]['content']['parts'])) {
        return '';
    }
    $texts = array();
    foreach ($data['candidates'][0]['content']['parts'] as $part) {
        if (!is_array($part)) {
            continue;
        }
        if (!empty($part['thought'])) {
            continue;
        }
        if (isset($part['text']) && is_string($part['text'])) {
            $texts[] = $part['text'];
        }
    }
    return implode('', $texts);
}

function study_is_retryable($status, $message)
{
    if ($status === 429 || $status === 503 || $status === 504 || $status === 500 || $status === 404) {
        return true;
    }
    if (stripos($message, 'retryable http error') !== false) {
        return true;
    }
    if ($status !== 400) {
        return false;
    }
    $msg = strtolower($message);
    return strpos($msg, 'model') !== false
        || strpos($msg, 'not found') !== false
        || strpos($msg, 'unsupported') !== false
        || strpos($msg, 'unknown') !== false;
}

function study_is_thinking_rejection($status, $message)
{
    return $status === 400 && stripos($message, 'thinking') !== false;
}

function study_gemini_once($apiKey, $model, $contents, $system, $maxTokens, $withThinking)
{
    $generation = array();
    if ($maxTokens > 0) {
        $generation['maxOutputTokens'] = $maxTokens;
    }
    if ($withThinking) {
        $generation['thinkingConfig'] = array('thinkingLevel' => 'low');
    }
    $payload = array('contents' => $contents);
    if ($generation) {
        $payload['generationConfig'] = $generation;
    }
    if ($system !== '') {
        $payload['systemInstruction'] = array(
            'parts' => array(array('text' => $system)),
        );
    }
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($body)) {
        return array('status' => 400, 'message' => 'encode', 'data' => array());
    }
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
    $ch = curl_init($url);
    $opts = array(
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ),
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
    );
    if (defined('CURLOPT_IPRESOLVE') && defined('CURL_IPRESOLVE_V4')) {
        $opts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno === 28 || $status === 0) {
        return array('status' => 504, 'message' => 'timeout', 'data' => array());
    }
    $data = array();
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }
    return array(
        'status' => $status,
        'message' => study_error_message($data),
        'data' => $data,
    );
}

function study_public_error($status)
{
    if ($status === 429) {
        return array(429, 'AI の利用回数が上限に達しました。しばらく時間をおいてからもう一度お試しください。');
    }
    if ($status === 503 || $status === 504) {
        return array(503, 'AI が混み合っています。少し待ってからもう一度お試しください。');
    }
    return array(502, 'AI との通信に失敗しました。');
}

function study_generate($apiKey, $contents, $system, $maxTokens)
{
    $models = array(
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
    );
    $lastStatus = 0;
    $lastMessage = '';
    foreach ($models as $model) {
        $tryThinking = array(true, false);
        foreach ($tryThinking as $withThinking) {
            $result = study_gemini_once($apiKey, $model, $contents, $system, $maxTokens, $withThinking);
            $status = (int) $result['status'];
            $message = (string) $result['message'];
            if ($status >= 200 && $status < 300) {
                $text = study_response_text($result['data']);
                if (trim($text) !== '') {
                    return array('ok' => true, 'text' => $text, 'status' => 200);
                }
                $lastStatus = 502;
                $lastMessage = 'empty';
                break;
            }
            $lastStatus = $status > 0 ? $status : 502;
            $lastMessage = $message;
            error_log('study-support gemini model=' . $model . ' status=' . $lastStatus);
            if ($withThinking && study_is_thinking_rejection($status, $message)) {
                continue;
            }
            break;
        }
        if (!study_is_retryable($lastStatus, $lastMessage)) {
            break;
        }
    }
    list($code, $msg) = study_public_error($lastStatus);
    return array('ok' => false, 'text' => '', 'status' => $code, 'error' => $msg);
}
