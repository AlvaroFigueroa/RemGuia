<?php
require_once __DIR__ . '/db_connection.php';

error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($payload, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

register_shutdown_function(function () {
    $error = error_get_last();
    if (!$error) return;

    $type = isset($error['type']) ? (int)$error['type'] : 0;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($type, $fatalTypes, true)) return;

    if (!headers_sent()) {
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fatal en el endpoint.',
        'error' => [
            'type' => $type,
            'message' => isset($error['message']) ? $error['message'] : '',
            'file' => isset($error['file']) ? $error['file'] : '',
            'line' => isset($error['line']) ? (int)$error['line'] : 0
        ]
    ]);
});

function bind_query_params($stmt, $types, &$params)
{
    if ($types === '' || empty($params)) {
        return true;
    }

    $bindParams = [];
    $bindParams[] = $types;

    foreach ($params as $index => &$value) {
        $bindParams[] = &$params[$index];
    }

    return call_user_func_array([$stmt, 'bind_param'], $bindParams);
}

$startDateInput = isset($_GET['startDate']) ? trim($_GET['startDate']) : null;
$endDateInput = isset($_GET['endDate']) ? trim($_GET['endDate']) : null;

if (!$startDateInput || !$endDateInput) {
    respond([
        'success' => false,
        'message' => 'Los parámetros startDate y endDate son obligatorios (formato YYYY-MM-DD).'
    ], 400);
}

$startDate = DateTime::createFromFormat('Y-m-d', $startDateInput);
$endDate = DateTime::createFromFormat('Y-m-d', $endDateInput);

if (!$startDate || !$endDate) {
    respond([
        'success' => false,
        'message' => 'Formato de fecha inválido. Usa YYYY-MM-DD.'
    ], 400);
}

$endDate->setTime(23, 59, 59);

$ubicacion = isset($_GET['ubicacion']) ? trim($_GET['ubicacion']) : null;

try {
    $mysqli = get_db_connection();
} catch (RuntimeException $e) {
    respond([
        'success' => false,
        'message' => $e->getMessage()
    ], $e->getCode() ?: 500);
}

// Nota: asumimos que la tabla "planta" posee las columnas:
// - fecha (datetime)
// - ubicacion (varchar)
// - base_1_media (int)   -> producción Base 1.5
// Ajusta los nombres si en la BD difieren.

$startParam = $startDate->format('Y-m-d 00:00:00');
$endParam = $endDate->format('Y-m-d H:i:s');

$conditions = [];
$params = [];
$types = '';

$periodSql = "SELECT ubicacion, COALESCE(SUM(base_1_media), 0) AS base15 FROM planta WHERE fecha BETWEEN ? AND ?";
$params[] = $startParam;
$params[] = $endParam;
$types .= 'ss';

if ($ubicacion && strcasecmp($ubicacion, 'Todos') !== 0) {
    $conditions[] = 'ubicacion LIKE ?';
    $types .= 's';
    $params[] = '%' . $ubicacion . '%';
}

if ($conditions) {
    $periodSql .= ' AND ' . implode(' AND ', $conditions);
}

$periodSql .= ' GROUP BY ubicacion';

$historicalSql = "SELECT ubicacion, COALESCE(SUM(base_1_media), 0) AS base15Acum FROM planta";
$paramsHist = [];
$typesHist = '';

$hoursSql = "SELECT ubicacion, COALESCE(SUM(horas), 0) AS horasAcum FROM planta";
$paramsHours = [];
$typesHours = '';

if ($ubicacion && strcasecmp($ubicacion, 'Todos') !== 0) {
    $historicalSql .= ' WHERE ubicacion LIKE ?';
    $typesHist .= 's';
    $paramsHist[] = '%' . $ubicacion . '%';

    $hoursSql .= ' WHERE ubicacion LIKE ?';
    $typesHours .= 's';
    $paramsHours[] = '%' . $ubicacion . '%';
}

$historicalSql .= ' GROUP BY ubicacion';
$hoursSql .= ' GROUP BY ubicacion';

$transportSql = "SELECT ubicacion, COALESCE(SUM(base_1_5), 0) AS base15TransportAcum FROM transporte";
$paramsTransport = [];
$typesTransport = '';

$vistaBellaCutoff = '2025-01-13 00:00:00';

if ($ubicacion && strcasecmp($ubicacion, 'Todos') !== 0) {
    $transportSql .= ' WHERE ubicacion LIKE ?';
    $typesTransport .= 's';
    $paramsTransport[] = '%' . $ubicacion . '%';
}

$transportSql .= ' GROUP BY ubicacion';

$vistaBellaTransportSql = "SELECT COALESCE(SUM(base_1_5), 0) AS base15TransportAcum FROM transporte WHERE ubicacion = 'Vista Bella' AND fecha >= ?";
$vistaBellaParams = [$vistaBellaCutoff];
$vistaBellaTypes = 's';

$periodStmt = $mysqli->prepare($periodSql);
if (!$periodStmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta (periodo).',
        'error' => $mysqli->error
    ], 500);
}

if (!bind_query_params($periodStmt, $types, $params)) {
    respond([
        'success' => false,
        'message' => 'No se pudo asociar parámetros (periodo).',
        'error' => $periodStmt->error
    ], 500);
}
if (!$periodStmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta (periodo).',
        'error' => $periodStmt->error
    ], 500);
}

$periodRows = [];
$periodUbicacion = null;
$periodBase15 = null;
if (!$periodStmt->bind_result($periodUbicacion, $periodBase15)) {
    respond([
        'success' => false,
        'message' => 'No se pudo asociar resultados (periodo).',
        'error' => $periodStmt->error
    ], 500);
}
while ($periodStmt->fetch()) {
    $name = is_string($periodUbicacion) ? trim($periodUbicacion) : '';
    if ($name === '') continue;
    $periodRows[$name] = [
        'planta' => $name,
        'base15' => (int)($periodBase15 ?? 0)
    ];
}
$periodStmt->close();

$histStmt = $mysqli->prepare($historicalSql);
if (!$histStmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta (historico).',
        'error' => $mysqli->error
    ], 500);
}

if ($typesHist) {
    if (!bind_query_params($histStmt, $typesHist, $paramsHist)) {
        respond([
            'success' => false,
            'message' => 'No se pudo asociar parámetros (historico).',
            'error' => $histStmt->error
        ], 500);
    }
}

if (!$histStmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta (historico).',
        'error' => $histStmt->error
    ], 500);
}
$producedByUbicacion = [];
$histUbicacion = null;
$histBase15Acum = null;
if (!$histStmt->bind_result($histUbicacion, $histBase15Acum)) {
    respond([
        'success' => false,
        'message' => 'No se pudo asociar resultados (historico).',
        'error' => $histStmt->error
    ], 500);
}
while ($histStmt->fetch()) {
    $name = is_string($histUbicacion) ? trim($histUbicacion) : '';
    if ($name === '') continue;
    $producedByUbicacion[$name] = (int)($histBase15Acum ?? 0);
}
$histStmt->close();

$hoursByUbicacion = [];
$hoursStmt = $mysqli->prepare($hoursSql);
if (!$hoursStmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta (horas historico).',
        'error' => $mysqli->error
    ], 500);
}

if ($typesHours) {
    if (!bind_query_params($hoursStmt, $typesHours, $paramsHours)) {
        respond([
            'success' => false,
            'message' => 'No se pudo asociar parámetros (horas historico).',
            'error' => $hoursStmt->error
        ], 500);
    }
}

if (!$hoursStmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta (horas historico).',
        'error' => $hoursStmt->error
    ], 500);
}

$hoursUbicacion = null;
$hoursAcum = null;
if (!$hoursStmt->bind_result($hoursUbicacion, $hoursAcum)) {
    respond([
        'success' => false,
        'message' => 'No se pudo asociar resultados (horas historico).',
        'error' => $hoursStmt->error
    ], 500);
}

while ($hoursStmt->fetch()) {
    $name = is_string($hoursUbicacion) ? trim($hoursUbicacion) : '';
    if ($name === '') continue;
    $hoursByUbicacion[$name] = (float)($hoursAcum ?? 0);
}

$hoursStmt->close();

$transportedByUbicacion = [];
$transportStmt = $mysqli->prepare($transportSql);
if (!$transportStmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta (transporte historico).',
        'error' => $mysqli->error
    ], 500);
}

if ($typesTransport) {
    if (!bind_query_params($transportStmt, $typesTransport, $paramsTransport)) {
        respond([
            'success' => false,
            'message' => 'No se pudo asociar parámetros (transporte historico).',
            'error' => $transportStmt->error
        ], 500);
    }
}

if (!$transportStmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta (transporte historico).',
        'error' => $transportStmt->error
    ], 500);
}

$transportUbicacion = null;
$transportBase15Acum = null;
if (!$transportStmt->bind_result($transportUbicacion, $transportBase15Acum)) {
    respond([
        'success' => false,
        'message' => 'No se pudo asociar resultados (transporte historico).',
        'error' => $transportStmt->error
    ], 500);
}

while ($transportStmt->fetch()) {
    $name = is_string($transportUbicacion) ? trim($transportUbicacion) : '';
    if ($name === '') continue;
    $transportedByUbicacion[$name] = (int)($transportBase15Acum ?? 0);
}
$transportStmt->close();

// Regla especial: para Vista Bella el transporte histórico se considera desde 2025-01-13 (inclusive).
// Solo aplica si estamos pidiendo todas las ubicaciones (o si el filtro incluye Vista Bella).
$shouldOverrideVistaBella = true;
if ($ubicacion && strcasecmp($ubicacion, 'Todos') !== 0) {
    $shouldOverrideVistaBella = stripos($ubicacion, 'vista bella') !== false;
}

if ($shouldOverrideVistaBella) {
    $vistaBellaStmt = $mysqli->prepare($vistaBellaTransportSql);
    if ($vistaBellaStmt) {
        if (!bind_query_params($vistaBellaStmt, $vistaBellaTypes, $vistaBellaParams)) {
            respond([
                'success' => false,
                'message' => 'No se pudo asociar parámetros (transporte Vista Bella).',
                'error' => $vistaBellaStmt->error
            ], 500);
        }

        if (!$vistaBellaStmt->execute()) {
            respond([
                'success' => false,
                'message' => 'Error al ejecutar la consulta (transporte Vista Bella).',
                'error' => $vistaBellaStmt->error
            ], 500);
        }

        $vistaBellaTransportAcum = 0;
        if (!$vistaBellaStmt->bind_result($vistaBellaTransportAcum)) {
            respond([
                'success' => false,
                'message' => 'No se pudo asociar resultados (transporte Vista Bella).',
                'error' => $vistaBellaStmt->error
            ], 500);
        }

        if ($vistaBellaStmt->fetch()) {
            $transportedByUbicacion['Vista Bella'] = (int)($vistaBellaTransportAcum ?? 0);
        }

        $vistaBellaStmt->close();
    }
}

$data = [];
foreach ($producedByUbicacion as $name => $producedAcum) {
    $period = isset($periodRows[$name]) ? $periodRows[$name]['base15'] : 0;
    $transported = isset($transportedByUbicacion[$name]) ? (int)$transportedByUbicacion[$name] : 0;
    $producedRaw = (int)$producedAcum;
    $producedAdj = (int)$producedAcum;
    if (strcasecmp(trim($name), 'Cocharcas') === 0) {
        $producedAdj = $producedAdj + 5297;
    }

    $stock = (int)$producedAdj - (int)$transported;

    if (strcasecmp(trim($name), 'Movil Cocharcas') === 0) {
        $stock = 0;
    }

    $horasAcum = isset($hoursByUbicacion[$name]) ? (float)$hoursByUbicacion[$name] : 0.0;
    $m3hHistorico = 0.0;
    if ($horasAcum > 0) {
        $m3hHistorico = ((float)$producedRaw) / $horasAcum;
    }

    $data[] = [
        'planta' => $name,
        'base15' => (int)$period,
        'base15Acum' => (int)$producedAdj,
        'stock' => (int)$stock,
        'm3hHistorico' => (float)$m3hHistorico
    ];
}

$mysqli->close();

usort($data, function ($a, $b) {
    return strcasecmp($a['planta'], $b['planta']);
});

respond([
    'success' => true,
    'data' => $data
]);
