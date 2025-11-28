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

try {
    $mysqli = get_db_connection();
} catch (RuntimeException $e) {
    respond([
        'success' => false,
        'message' => $e->getMessage()
    ], $e->getCode() ?: 500);
}

$query = 'SELECT ubicacion FROM ubi GROUP BY ubicacion';
$result = $mysqli->query($query);

if (!$result) {
    $mysqli->close();
    respond([
        'success' => false,
        'message' => 'No se pudieron obtener las ubicaciones.',
        'error' => $mysqli->error
    ], 500);
}

$ubicaciones = [];
$index = 1;
while ($row = $result->fetch_assoc()) {
    $nombre = isset($row['ubicacion']) ? trim($row['ubicacion']) : '';
    if ($nombre === '') {
        continue;
    }

    $ubicaciones[] = [
        'id' => $index++,
        'name' => $nombre
    ];
}

$result->free();
$mysqli->close();

respond([
    'success' => true,
    'data' => $ubicaciones
]);
