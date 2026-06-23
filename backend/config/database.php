<?php
// backend/config/database.php

class Database
{
    private static $instance = null;
    private $pdo;

    private function __construct()
    {
        $host = getenv('DB_HOST') ?: 'db';
        $db   = getenv('DB_NAME') ?: 'visormpp';
        $user = getenv('DB_USER') ?: 'visoruser';
        $pass = getenv('DB_PASS') ?: 'visorpass';
        $port = "5432";

        $dsn = "pgsql:host=$host;port=$port;dbname=$db;";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->pdo = new PDO($dsn, $user, $pass, $options);
        } catch (\PDOException $e) {
            // En producción, loguear el error y no mostrarlo directamente
            error_log($e->getMessage());
            throw new \Exception("Error de conexión a la base de datos");
        }
    }

    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->pdo;
    }
}
