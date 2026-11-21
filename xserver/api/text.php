<?php
// 画面側の cleanExplanation / normalizeMathSymbols と同じ整形。

function study_protect_literals($text)
{
    $saved = array();
    $start = "\u{E0DC}";
    $end = "\u{E0DD}";
    $keep = function ($m) use (&$saved, $start, $end) {
        $saved[] = $m[0];
        return $start . (count($saved) - 1) . $end;
    };
    $s = preg_replace_callback('~https?://[^\s）)」』】]+~u', $keep, $text);
    if (!is_string($s)) {
        $s = $text;
    }
    $s2 = preg_replace_callback('~\b(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})\b~', $keep, $s);
    if (is_string($s2)) {
        $s = $s2;
    }
    $unitToken = '(?:km|cm|mm|nm|m|kg|mg|g|t|L|mL|dL|kL|h|min|s|sec|ms|N|J|W|kW|kWh|Wh|Pa|hPa|kPa|Hz|kHz|MHz|mol|cal|kcal|A|V|Ω|C|K|rad|deg|ha|a|ppm|人|円|個|回|匹|台|枚|本|冊|秒|分|時間|時|日|年|月|週|世帯|km²|m²|cm²|km³|m³|cm³|㎡|㎥|㎢)';
    $unitRe = '~(^|[^A-Za-z0-9\x{3040}-\x{30ff}\x{4e00}-\x{9fff}])(' . $unitToken . '(?:[²³]|\^[23])?\s*/\s*' . $unitToken . '(?:[²³]|\^[23])?)(?![A-Za-z0-9\x{3040}-\x{30ff}\x{4e00}-\x{9fff}])~u';
    $s3 = preg_replace_callback($unitRe, function ($m) use ($keep) {
        return $m[1] . $keep(array($m[2]));
    }, $s);
    if (is_string($s3)) {
        $s = $s3;
    }
    return array($s, $saved, $start, $end);
}

function study_restore_literals($s, $saved, $start, $end)
{
    $out = preg_replace_callback(
        '~' . $start . '(\d+)' . $end . '~u',
        function ($m) use ($saved) {
            $i = (int) $m[1];
            return isset($saved[$i]) ? $saved[$i] : $m[0];
        },
        $s
    );
    return is_string($out) ? $out : $s;
}

function study_asterisk_to_times($s)
{
    $re = '~([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√²³)\]}])(\s*)\*(\s*)([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω%％+^√(\[{])~u';
    for ($i = 0; $i < 20; $i++) {
        $next = preg_replace($re, '$1$2×$3$4', $s);
        if (!is_string($next) || $next === $s) {
            break;
        }
        $s = $next;
    }
    return $s;
}

function study_slash_to_divide($s)
{
    $digit = '~\b(\d+(?:\.\d+)?)(\s*)/(\s*)(\d+(?:\.\d+)?)\b~';
    for ($i = 0; $i < 15; $i++) {
        $next = preg_replace($digit, '$1$2÷$3$4', $s);
        if (!is_string($next) || $next === $s) {
            break;
        }
        $s = $next;
    }
    $alnum = '~([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω²³]+(?:\.[0-9０-９]+)?)(\s*)/(\s*)([0-9０-９a-zA-Zxyztπ∞α-ωΑ-Ω]+(?:\.[0-9０-９]+)?)~u';
    for ($i = 0; $i < 15; $i++) {
        $next = preg_replace($alnum, '$1$2÷$3$4', $s);
        if (!is_string($next) || $next === $s) {
            break;
        }
        $s = $next;
    }
    return $s;
}

function study_normalize_math($text)
{
    if (!is_string($text) || $text === '') {
        return is_string($text) ? $text : '';
    }
    list($s, $saved, $start, $end) = study_protect_literals($text);
    $s = study_asterisk_to_times($s);
    $s = study_slash_to_divide($s);
    return study_restore_literals($s, $saved, $start, $end);
}

function study_strip_latex($text)
{
    $l = "\u{E001}";
    $r = "\u{E002}";
    $result = str_replace(
        array('&#36;', '\\(', '\\)', '\\[', '\\]'),
        array('$', $l, $r, $l, $r),
        $text
    );
    for ($i = 0; $i < 10; $i++) {
        $prev = $result;
        $next = preg_replace('/\$+([^$]*?)\$+/', '$1', $result);
        if (is_string($next)) {
            $result = $next;
        }
        $next = preg_replace('~' . $l . '([\s\S]*?)' . $r . '~u', '$1', $result);
        if (is_string($next)) {
            $result = $next;
        }
        if ($result === $prev) {
            break;
        }
    }
    $result = str_replace(array($l, $r), '', $result);
    $result = preg_replace('/[\$＄﹩\x{FF04}\x{FE69}]/u', '', $result);
    if (!is_string($result)) {
        $result = $text;
    }
    $result = preg_replace('/\\\\frac\{([^{}]*)\}\{([^{}]*)\}/', '$1/$2', $result);
    $result = preg_replace('/\\\\sqrt\{([^{}]*)\}/', '√($1)', $result);
    $map = array(
        '\\times' => '×',
        '\\div' => '÷',
        '\\cdot' => '×',
        '\\pm' => '±',
        '\\pi' => 'π',
        '\\left' => '',
        '\\right' => '',
    );
    if (is_string($result)) {
        $result = str_replace(array_keys($map), array_values($map), $result);
        $result = preg_replace('/\\\\le(?:q)?\b/', '≦', $result);
        $result = preg_replace('/\\\\ge(?:q)?\b/', '≧', $result);
        $result = preg_replace('/\\\\neq?\b/', '≠', $result);
        $result = preg_replace('/\\\\,|\\\\;|\\\\!|\\\\quad|\\\\qquad/', ' ', $result);
    }
    return is_string($result) ? $result : $text;
}

function study_strip_markdown($text)
{
    $s = preg_replace('/```[a-zA-Z]*\n?/', '', $text);
    if (!is_string($s)) {
        $s = $text;
    }
    $next = preg_replace('/`([^`\n]*)`/', '$1', $s);
    if (is_string($next)) {
        $s = $next;
    }
    $next = preg_replace('/^[ \t]*#{1,6}[ \t]+/m', '', $s);
    if (is_string($next)) {
        $s = $next;
    }
    for ($i = 0; $i < 5; $i++) {
        $prev = $s;
        $next = preg_replace('/\*\*\*([^*\n]+?)\*\*\*/', '$1', $s);
        if (is_string($next)) {
            $s = $next;
        }
        $next = preg_replace('/\*\*([^*\n]+?)\*\*/', '$1', $s);
        if (is_string($next)) {
            $s = $next;
        }
        $next = preg_replace('/__([^_\n]+?)__/', '$1', $s);
        if (is_string($next)) {
            $s = $next;
        }
        if ($s === $prev) {
            break;
        }
    }
    $next = preg_replace('/^([ \t]*)[\*\-\+][ \t]+/m', '$1・', $s);
    if (is_string($next)) {
        $s = $next;
    }
    $next = preg_replace('/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/m', '', $s);
    if (is_string($next)) {
        $s = $next;
    }
    $s = str_replace('**', '', $s);
    $next = preg_replace("/\n{3,}/", "\n\n", $s);
    if (is_string($next)) {
        $s = $next;
    }
    return $s;
}

function study_clean_explanation($text)
{
    if (!is_string($text) || $text === '') {
        return is_string($text) ? $text : '';
    }
    $s = study_strip_latex($text);
    $s = study_strip_markdown($s);
    $s = study_normalize_math($s);
    return trim($s);
}
