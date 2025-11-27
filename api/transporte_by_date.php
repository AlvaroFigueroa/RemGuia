<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

define('DB_HOST', 'eth.v2net.cl:3306');
define('DB_USER', 'remfi1_rem');
define('DB_PASS', 'Cb^WUyO%le0R');
define('DB_NAME', 'remfi1_remfisc');

function respond($payload, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
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

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($mysqli->connect_errno) {
    respond([
        'success' => false,
        'message' => 'Error al conectar a la base de datos',
        'error' => $mysqli->connect_error
    ], 500);
}

$mysqli->set_charset('utf8mb4');

$sql = "SELECT * FROM transporte WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC";
$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta.',
        'error' => $mysqli->error
    ], 500);
}

$startParam = $startDate->format('Y-m-d 00:00:00');
$endParam = $endDate->format('Y-m-d H:i:s');
$stmt->bind_param('ss', $startParam, $endParam);

if (!$stmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta.',
        'error' => $stmt->error
    ], 500);
}

$result = $stmt->get_result();
$rows = [];

while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

$stmt->close();
$mysqli->close();

respond([
    'success' => true,
    'message' => 'Datos obtenidos correctamente.',
    'filters' => [
        'startDate' => $startParam,
        'endDate' => $endParam
    ],
    'count' => count($rows),
    'data' => $rows
]);
