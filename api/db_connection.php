<?php
const DB_HOST = 'eth.v2net.cl:3306';
const DB_USER = 'remfi1_rem';
const DB_PASS = 'Cb^WUyO%le0R';
const DB_NAME = 'remfi1_remfisc';

function get_db_connection()
{
    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($mysqli->connect_errno) {
        throw new RuntimeException('Error al conectar a la base de datos: ' . $mysqli->connect_error, 500);
    }

    $mysqli->set_charset('utf8mb4');
    return $mysqli;
}

if (php_sapi_name() !== 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    header('Content-Type: application/json');
    try {
        $mysqli = get_db_connection();
        echo json_encode([
            'success' => true,
            'message' => 'Conexión exitosa a la base de datos'
        ]);
        $mysqli->close();
    } catch (RuntimeException $e) {
        http_response_code($e->getCode() ?: 500);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
    exit;
}
