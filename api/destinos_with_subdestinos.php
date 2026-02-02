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

    $destinos[$destinoNombre] = [
        'id' => $autoincrement++,
        'name' => $destinoNombre,
        'subDestinations' => []
    ];
}

$result->free();

$subQuery = 'SELECT SubDesGDSur, SubDesGDNorte, subD413884, subD416335, subD417998 FROM destinos';
$subResult = $mysqli->query($subQuery);

if ($subResult) {
    $subDestinosMap = [
        'Global Diguillin Sur' => [],
        'Global Diguillin Norte' => [],
        'SAFI 413884' => [],
        'SAFI 416335' => [],
        'SAFI 417998' => []
    ];

    while ($row = $subResult->fetch_assoc()) {
        $sur = isset($row['SubDesGDSur']) ? trim($row['SubDesGDSur']) : '';
        $norte = isset($row['SubDesGDNorte']) ? trim($row['SubDesGDNorte']) : '';
        $safi413884 = isset($row['subD413884']) ? trim($row['subD413884']) : '';
        $safi416335 = isset($row['subD416335']) ? trim($row['subD416335']) : '';
        $safi417998 = isset($row['subD417998']) ? trim($row['subD417998']) : '';

        if ($sur !== '') {
            $subDestinosMap['Global Diguillin Sur'][] = $sur;
        }
        if ($norte !== '') {
            $subDestinosMap['Global Diguillin Norte'][] = $norte;
        }
        if ($safi413884 !== '') {
            $subDestinosMap['SAFI 413884'][] = $safi413884;
        }
        if ($safi416335 !== '') {
            $subDestinosMap['SAFI 416335'][] = $safi416335;
        }
        if ($safi417998 !== '') {
            $subDestinosMap['SAFI 417998'][] = $safi417998;
        }
    }

    $subResult->free();

    $ensureDestino = function ($name) use (&$destinos, &$autoincrement) {
        if (!isset($destinos[$name])) {
            $destinos[$name] = [
                'id' => $autoincrement++,
                'name' => $name,
                'subDestinations' => []
            ];
        }
    };

    $mergeValues = function ($destName, $values) use (&$destinos, $ensureDestino) {
        if (empty($values)) {
            return;
        }
        $ensureDestino($destName);
        $destinos[$destName]['subDestinations'] = array_values(array_unique(array_merge(
            $destinos[$destName]['subDestinations'],
            $values
        )));
        sort($destinos[$destName]['subDestinations']);
    };

    $mergeValues('Global Diguillin Sur', $subDestinosMap['Global Diguillin Sur']);
    $mergeValues('Global Diguillin Norte', $subDestinosMap['Global Diguillin Norte']);
    $mergeValues('SAFI 413884', $subDestinosMap['SAFI 413884']);
    $mergeValues('SAFI 416335', $subDestinosMap['SAFI 416335']);
    $mergeValues('SAFI 417998', $subDestinosMap['SAFI 417998']);
}

$mysqli->close();

respond([
    'success' => true,
    'data' => array_values($destinos)
]);
