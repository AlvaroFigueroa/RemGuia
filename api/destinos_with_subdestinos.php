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

$sql = 'SELECT destino FROM destinos GROUP BY destino';
$result = $mysqli->query($sql);

if (!$result) {
    $mysqli->close();
    respond([
        'success' => false,
        'message' => 'No se pudo ejecutar la consulta de destinos.',
        'error' => $mysqli->error
    ], 500);
}

$destinos = [];
$autoincrement = 1;
while ($row = $result->fetch_assoc()) {
    $destinoNombre = isset($row['destino']) && trim($row['destino']) !== ''
        ? trim($row['destino'])
        : 'Destino sin nombre';

    $destinos[] = [
        'id' => $autoincrement++,
        'name' => $destinoNombre,
        'subDestinations' => []
    ];
}

$result->free();
$mysqli->close();

respond([
    'success' => true,
    'data' => array_values($destinos)
]);
