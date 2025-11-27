<?php
// Conexión a la base de datos MySQL
$DB_HOST = 'eth.v2net.cl:3306';
$DB_USER = 'remfi1_rem';
$DB_PASS = 'Cb^WUyO%le0R';
$DB_NAME = 'remfi1_remfisc';

$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al conectar a la base de datos',
        'error' => $mysqli->connect_error
    ]);
    exit;
}

$mysqli->set_charset('utf8mb4');

echo json_encode([
    'success' => true,
    'message' => 'Conexión exitosa a la base de datos'
]);

$mysqli->close();
