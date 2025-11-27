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

$sql = 'SELECT * FROM destinos';
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
while ($row = $result->fetch_assoc()) {
    $destinoId = isset($row['id']) ? (int)$row['id'] : crc32(json_encode($row));
    $destinoNombre = $row['destino'] ?? $row['nombre'] ?? ($row['Destinos'] ?? 'Destino sin nombre');
    $subdestino = $row['subdestino'] ?? $row['sub_destino'] ?? $row['subDestino'] ?? null;

    if (!isset($destinos[$destinoId])) {
        $destinos[$destinoId] = [
            'id' => $destinoId,
            'name' => $destinoNombre,
            'subDestinations' => []
        ];
    }

    if ($subdestino) {
        $destinos[$destinoId]['subDestinations'][] = $subdestino;
    }
}

$result->free();
$mysqli->close();

respond([
    'success' => true,
    'data' => array_values($destinos)
]);
