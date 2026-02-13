<?php
require_once __DIR__ . '/db_connection.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($payload, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

try {
    $mysqli = get_db_connection();
} catch (RuntimeException $e) {
    respond([
        'success' => false,
        'message' => $e->getMessage()
    ], $e->getCode() ?: 500);
}

$sql = "SELECT destino, subdestino, base_1_5, integral, bolones, id_requerimiento FROM requerimientos ORDER BY id_requerimiento DESC";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    respond([
        'success' => false,
        'message' => 'No se pudo preparar la consulta.',
        'error' => $mysqli->error
    ], 500);
}

if (!$stmt->execute()) {
    respond([
        'success' => false,
        'message' => 'Error al ejecutar la consulta.',
        'error' => $stmt->error
    ], 500);
}

$stmt->bind_result($destino, $subdestino, $base_1_5, $integral, $bolones, $id_requerimiento);

$rows = [];
while ($stmt->fetch()) {
    $rows[] = [
        'destino' => $destino,
        'subdestino' => $subdestino,
        'base_1_5' => $base_1_5,
        'integral' => $integral,
        'bolones' => $bolones,
        'id_requerimiento' => $id_requerimiento
    ];
}

$stmt->close();
$mysqli->close();

respond([
    'success' => true,
    'message' => 'Requerimientos obtenidos correctamente.',
    'count' => count($rows),
    'data' => $rows
]);
