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

$guideInput = isset($_GET['guide']) ? trim($_GET['guide']) : null;
if (!$guideInput && isset($_GET['guideNumber'])) {
    $guideInput = trim($_GET['guideNumber']);
}

if (!$guideInput) {
    respond([
        'success' => false,
        'message' => 'El parámetro guide o guideNumber es obligatorio.'
    ], 400);
}

try {
    $mysqli = get_db_connection();
} catch (RuntimeException $e) {
    respond([
        'success' => false,
        'message' => $e->getMessage()
    ], $e->getCode() ?: 500);
}

$likeValue = '%' . $guideInput . '%';
$sql = "SELECT * FROM transporte WHERE guiaNumero LIKE ? OR guia LIKE ? OR numero LIKE ? ORDER BY fecha DESC LIMIT 200";
$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta.',
        'error' => $mysqli->error
    ], 500);
}

$stmt->bind_param('sss', $likeValue, $likeValue, $likeValue);

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
    'message' => 'Resultados encontrados para la guía especificada.',
    'count' => count($rows),
    'query' => $guideInput,
    'data' => $rows
]);
