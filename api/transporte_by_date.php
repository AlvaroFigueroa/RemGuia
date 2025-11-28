<?php
require_once __DIR__ . '/db_connection.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

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

$ubicacion = isset($_GET['ubicacion']) ? trim($_GET['ubicacion']) : null;
$destino = isset($_GET['destino']) ? trim($_GET['destino']) : null;
$subDestino = isset($_GET['subDestino']) ? trim($_GET['subDestino']) : null;

try {
    $mysqli = get_db_connection();
} catch (RuntimeException $e) {
    respond([
        'success' => false,
        'message' => $e->getMessage()
    ], $e->getCode() ?: 500);
}

$baseSql = "SELECT * FROM transporte WHERE fecha BETWEEN ? AND ?";
$conditions = [];
$params = [];
$types = 'ss';

$startParam = $startDate->format('Y-m-d 00:00:00');
$endParam = $endDate->format('Y-m-d H:i:s');
$params[] = $startParam;
$params[] = $endParam;

if ($ubicacion && strcasecmp($ubicacion, 'Todos') !== 0) {
    $conditions[] = 'ubicacion LIKE ?';
    $types .= 's';
    $params[] = '%' . $ubicacion . '%';
}

if ($destino && strcasecmp($destino, 'Todos') !== 0) {
    $conditions[] = 'destino LIKE ?';
    $types .= 's';
    $params[] = '%' . $destino . '%';
}

if ($subDestino && strcasecmp($subDestino, 'Todos') !== 0) {
    $conditions[] = 'subDestino LIKE ?';
    $types .= 's';
    $params[] = '%' . $subDestino . '%';
}

if ($conditions) {
    $baseSql .= ' AND ' . implode(' AND ', $conditions);
}

$baseSql .= ' ORDER BY fecha DESC';

$stmt = $mysqli->prepare($baseSql);

if (!$stmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta.',
        'error' => $mysqli->error
    ], 500);
}

$stmt->bind_param($types, ...$params);

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
