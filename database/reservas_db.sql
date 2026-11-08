-- =====================================================================
-- TP FINAL MSII 2026 - Plataforma de reservas de restaurante
-- Base de datos: MySQL 8.0+
-- =====================================================================

DROP DATABASE IF EXISTS reservas_db;
CREATE DATABASE reservas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE reservas_db;

-- ---------------------------------------------------------------------
-- 1) TABLAS
-- Relaciones:
--   restaurantes 1 --- N mesas
--   mesas        1 --- N reservas
--   usuarios     1 --- N reservas
--   reservas     1 --- 1 pagos (el cobro de la reserva)
--   usuarios     1 --- N pagos (quien registro el cobro)
--   restaurantes 1 --- N platos (el menu)
--   reservas     1 --- N pedido_items --- 1 platos (lo que pidio)
-- ---------------------------------------------------------------------

CREATE TABLE usuarios (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    rol            ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
    creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE restaurantes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    direccion   VARCHAR(200) NOT NULL,
    telefono    VARCHAR(30)  NOT NULL,
    activo      BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE mesas (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id   INT NOT NULL,
    numero           INT NOT NULL,
    capacidad        INT NOT NULL,
    activa           BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_mesas_restaurante
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_mesa_numero UNIQUE (restaurante_id, numero),
    CONSTRAINT ck_mesa_capacidad CHECK (capacidad BETWEEN 1 AND 20)
) ENGINE=InnoDB;

CREATE TABLE reservas (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id         INT NOT NULL,
    mesa_id            INT NOT NULL,
    fecha              DATE NOT NULL,
    hora               TIME NOT NULL,
    cantidad_personas  INT NOT NULL,
    estado             ENUM('confirmada', 'cancelada', 'completada', 'en_curso')
                       NOT NULL DEFAULT 'confirmada',
    llegada_en         DATETIME NULL,      -- cuando ingreso el cliente (pasa a en_curso)
    finalizada_en      DATETIME NULL,      -- cuando pago y libero la mesa (completada)
    momento_servicio   ENUM('al_entrar', 'min_10', 'min_20', 'personalizado') NULL,  -- cuando quiere recibir la comida
    hora_servicio      TIME NULL,          -- solo si momento_servicio = 'personalizado'
    creada_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservas_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_reservas_mesa
        FOREIGN KEY (mesa_id) REFERENCES mesas(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_reserva_personas CHECK (cantidad_personas BETWEEN 1 AND 20),
    CONSTRAINT ck_reserva_servicio
        CHECK (momento_servicio IS NULL OR ((momento_servicio = 'personalizado') = (hora_servicio IS NOT NULL))),
    INDEX idx_reservas_mesa_fecha (mesa_id, fecha, hora)
) ENGINE=InnoDB;

CREATE TABLE pagos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id      INT NOT NULL UNIQUE,   -- una reserva se cobra una sola vez
    monto           DECIMAL(10,2) NOT NULL,
    medio_pago      ENUM('efectivo', 'tarjeta', 'transferencia', 'mercado_pago') NOT NULL,
    pagado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    registrado_por  INT NOT NULL,          -- usuario (admin) que registro el cobro
    CONSTRAINT fk_pagos_reserva
        FOREIGN KEY (reserva_id) REFERENCES reservas(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pagos_usuario
        FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_pago_monto CHECK (monto > 0),
    INDEX idx_pagos_fecha (pagado_en)
) ENGINE=InnoDB;

-- Menu del restaurante y pedido de comida de cada reserva
CREATE TABLE IF NOT EXISTS platos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id  INT NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(255) NOT NULL DEFAULT '',
    precio          DECIMAL(10,2) NOT NULL,
    disponible      BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_platos_restaurante
        FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_plato_restaurante UNIQUE (restaurante_id, nombre),
    CONSTRAINT ck_plato_precio CHECK (precio > 0)
) ENGINE=InnoDB;

-- Pedido de comida de una reserva. precio_unitario guarda el precio del plato
-- al momento de pedir: si despues cambia el menu, el total ya pedido no se altera.
CREATE TABLE IF NOT EXISTS pedido_items (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    reserva_id       INT NOT NULL,
    plato_id         INT NOT NULL,
    cantidad         INT NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_items_reserva
        FOREIGN KEY (reserva_id) REFERENCES reservas(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_items_plato
        FOREIGN KEY (plato_id) REFERENCES platos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_item_reserva_plato UNIQUE (reserva_id, plato_id),
    CONSTRAINT ck_item_cantidad CHECK (cantidad BETWEEN 1 AND 20),
    CONSTRAINT ck_item_precio CHECK (precio_unitario > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) FUNCIONES Y STORED PROCEDURES (reglas de negocio con transacciones)
--
-- Ciclo de vida de una reserva:
--   confirmada --(llega el cliente)--> en_curso --(paga)--> completada
--   confirmada --(se cancela)--------> cancelada
--
-- Una mesa esta OCUPADA mientras tenga una reserva en_curso y queda LIBRE
-- en el mismo instante en que se registra el pago, sin importar cuanto
-- tiempo haya pasado. No hay un tope fijo de duracion.
--
-- El "tiempo estimado" (fn_minutos_estimados) se usa SOLO para planificar
-- reservas futuras: evita que se agenden dos reservas casi pegadas en la
-- misma mesa. Para cambiarlo, editar el numero de esa funcion.
-- ---------------------------------------------------------------------

DELIMITER $$

CREATE FUNCTION fn_minutos_estimados()
RETURNS INT
DETERMINISTIC
NO SQL
BEGIN
    RETURN 120;
END$$

-- Cuenta las reservas que impiden usar la mesa p_mesa_id a partir de p_inicio.
--   * confirmada: bloquea si su horario esta a menos del tiempo estimado.
--   * en_curso:   hay clientes sentados; bloquea hasta el tiempo estimado
--                 desde que llegaron o, si ya se pasaron, los proximos
--                 30 minutos (hasta que se registre el cobro).
--   * completada / cancelada: no bloquean (la mesa ya esta libre).
-- p_excluir permite ignorar una reserva (al modificarla).
CREATE FUNCTION fn_conflictos_mesa(
    p_mesa_id  INT,
    p_inicio   DATETIME,
    p_excluir  INT
)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_min        INT;
    DECLARE v_conflictos INT;

    SET v_min = fn_minutos_estimados();

    SELECT COUNT(*) INTO v_conflictos
    FROM reservas r
    WHERE r.mesa_id = p_mesa_id
      AND r.id <> p_excluir
      AND (
            (r.estado = 'confirmada'
             AND r.fecha BETWEEN DATE_SUB(DATE(p_inicio), INTERVAL 1 DAY)
                             AND DATE_ADD(DATE(p_inicio), INTERVAL 1 DAY)
             AND ABS(TIMESTAMPDIFF(SECOND, TIMESTAMP(r.fecha, r.hora), p_inicio)) < v_min * 60)
         OR (r.estado = 'en_curso'
             AND p_inicio < GREATEST(
                    COALESCE(r.llegada_en, TIMESTAMP(r.fecha, r.hora)) + INTERVAL v_min MINUTE,
                    NOW() + INTERVAL 30 MINUTE))
      );

    RETURN v_conflictos;
END$$

CREATE PROCEDURE sp_crear_reserva(
    IN  p_usuario_id  INT,
    IN  p_mesa_id     INT,
    IN  p_fecha       DATE,
    IN  p_hora        TIME,
    IN  p_personas    INT,
    OUT p_reserva_id  INT
)
BEGIN
    DECLARE v_capacidad  INT;
    DECLARE v_conflictos INT;

    -- Ante cualquier error SQL: deshacer todo y propagar el error
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Bloquea la fila de la mesa: si dos clientes reservan a la vez,
    -- el segundo espera a que termine el primero (evita doble reserva)
    SELECT capacidad INTO v_capacidad
    FROM mesas
    WHERE id = p_mesa_id AND activa = TRUE
    FOR UPDATE;

    IF v_capacidad IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La mesa no existe o no esta activa';
    END IF;

    IF p_personas > v_capacidad THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La cantidad de personas supera la capacidad de la mesa';
    END IF;

    IF TIMESTAMP(p_fecha, p_hora) < NOW() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede reservar en una fecha/hora pasada';
    END IF;

    SET v_conflictos = fn_conflictos_mesa(p_mesa_id, TIMESTAMP(p_fecha, p_hora), 0);

    IF v_conflictos > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La mesa ya esta reservada u ocupada en ese horario';
    END IF;

    INSERT INTO reservas (usuario_id, mesa_id, fecha, hora, cantidad_personas)
    VALUES (p_usuario_id, p_mesa_id, p_fecha, p_hora, p_personas);

    SET p_reserva_id = LAST_INSERT_ID();

    COMMIT;
END$$

-- Modifica una reserva confirmada (misma logica transaccional).
-- Ignora la propia reserva al buscar conflictos de horario.
CREATE PROCEDURE sp_modificar_reserva(
    IN p_reserva_id  INT,
    IN p_mesa_id     INT,
    IN p_fecha       DATE,
    IN p_hora        TIME,
    IN p_personas    INT
)
BEGIN
    DECLARE v_estado     VARCHAR(20);
    DECLARE v_capacidad  INT;
    DECLARE v_conflictos INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado FROM reservas WHERE id = p_reserva_id FOR UPDATE;

    IF v_estado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La reserva no existe';
    END IF;

    IF v_estado <> 'confirmada' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se pueden modificar reservas confirmadas';
    END IF;

    SELECT capacidad INTO v_capacidad
    FROM mesas
    WHERE id = p_mesa_id AND activa = TRUE
    FOR UPDATE;

    IF v_capacidad IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La mesa no existe o no esta activa';
    END IF;

    IF p_personas > v_capacidad THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La cantidad de personas supera la capacidad de la mesa';
    END IF;

    IF TIMESTAMP(p_fecha, p_hora) < NOW() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede reservar en una fecha/hora pasada';
    END IF;

    SET v_conflictos = fn_conflictos_mesa(p_mesa_id, TIMESTAMP(p_fecha, p_hora), p_reserva_id);

    IF v_conflictos > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La mesa ya esta reservada u ocupada en ese horario';
    END IF;

    UPDATE reservas
    SET mesa_id = p_mesa_id, fecha = p_fecha, hora = p_hora, cantidad_personas = p_personas
    WHERE id = p_reserva_id;

    COMMIT;
END$$

-- Registra el momento en que ingresa el cliente: la mesa pasa a OCUPADA.
CREATE PROCEDURE sp_registrar_llegada(
    IN p_reserva_id INT
)
BEGIN
    DECLARE v_estado   VARCHAR(20);
    DECLARE v_mesa     INT;
    DECLARE v_fecha    DATE;
    DECLARE v_lock     INT;
    DECLARE v_ocupadas INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado, mesa_id, fecha INTO v_estado, v_mesa, v_fecha
    FROM reservas
    WHERE id = p_reserva_id
    FOR UPDATE;

    IF v_estado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La reserva no existe';
    END IF;

    IF v_estado <> 'confirmada' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se puede registrar la llegada de reservas confirmadas';
    END IF;

    IF v_fecha <> CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La reserva no es para el dia de hoy';
    END IF;

    -- Bloquea la mesa para que dos llegadas simultaneas no la ocupen a la vez
    SELECT id INTO v_lock FROM mesas WHERE id = v_mesa FOR UPDATE;

    SELECT COUNT(*) INTO v_ocupadas
    FROM reservas
    WHERE mesa_id = v_mesa AND estado = 'en_curso' AND id <> p_reserva_id;

    IF v_ocupadas > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La mesa sigue ocupada: primero hay que cobrar a los clientes que estan en ella';
    END IF;

    UPDATE reservas
    SET estado = 'en_curso', llegada_en = NOW()
    WHERE id = p_reserva_id;

    COMMIT;
END$$

-- Registra el momento en que ingresa el dinero: guarda el pago y cierra la
-- reserva en una sola transaccion. La mesa queda LIBRE al instante.
CREATE PROCEDURE sp_cobrar_reserva(
    IN  p_reserva_id  INT,
    IN  p_monto       DECIMAL(10,2),
    IN  p_medio_pago  VARCHAR(20),
    IN  p_usuario_id  INT,
    OUT p_pago_id     INT
)
BEGIN
    DECLARE v_estado VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT estado INTO v_estado FROM reservas WHERE id = p_reserva_id FOR UPDATE;

    IF v_estado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La reserva no existe';
    END IF;

    IF v_estado <> 'en_curso' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se puede cobrar una reserva en curso (con los clientes en la mesa)';
    END IF;

    IF p_monto IS NULL OR p_monto <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto debe ser mayor a cero';
    END IF;

    INSERT INTO pagos (reserva_id, monto, medio_pago, registrado_por)
    VALUES (p_reserva_id, p_monto, p_medio_pago, p_usuario_id);

    SET p_pago_id = LAST_INSERT_ID();

    UPDATE reservas
    SET estado = 'completada', finalizada_en = NOW()
    WHERE id = p_reserva_id;

    COMMIT;
END$$

-- Guarda (reemplaza) el pedido de comida de una reserva en una sola transaccion.
-- p_items es un JSON: [{"plato_id": 1, "cantidad": 2}, ...]  (lista vacia = sin pedido)
-- Valida que los platos sean del restaurante de la mesa y estén disponibles, y
-- guarda el precio vigente de cada plato.
DROP PROCEDURE IF EXISTS sp_guardar_pedido$$

CREATE PROCEDURE sp_guardar_pedido(
    IN p_reserva_id  INT,
    IN p_items       JSON
)
BEGIN
    DECLARE v_estado       VARCHAR(20);
    DECLARE v_restaurante  INT;
    DECLARE v_invalidos    INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT r.estado, m.restaurante_id INTO v_estado, v_restaurante
    FROM reservas r
    INNER JOIN mesas m ON m.id = r.mesa_id
    WHERE r.id = p_reserva_id
    FOR UPDATE;

    IF v_estado IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La reserva no existe';
    END IF;

    IF v_estado NOT IN ('confirmada', 'en_curso') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se puede cambiar el pedido de reservas confirmadas o en curso';
    END IF;

    SELECT COUNT(*) INTO v_invalidos
    FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
            plato_id INT PATH '$.plato_id',
            cantidad INT PATH '$.cantidad')) j
    LEFT JOIN platos p
           ON p.id = j.plato_id AND p.restaurante_id = v_restaurante AND p.disponible = TRUE
    WHERE p.id IS NULL OR j.cantidad IS NULL OR j.cantidad < 1 OR j.cantidad > 20;

    IF v_invalidos > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El pedido tiene platos que no son de este restaurante, no estan disponibles o con cantidad invalida';
    END IF;

    DELETE FROM pedido_items WHERE reserva_id = p_reserva_id;

    INSERT INTO pedido_items (reserva_id, plato_id, cantidad, precio_unitario)
    SELECT p_reserva_id, p.id, SUM(j.cantidad), p.precio
    FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
            plato_id INT PATH '$.plato_id',
            cantidad INT PATH '$.cantidad')) j
    INNER JOIN platos p ON p.id = j.plato_id
    GROUP BY p.id, p.precio;

    -- Sin comida pedida no tiene sentido un horario de servicio
    IF NOT EXISTS (SELECT 1 FROM pedido_items WHERE reserva_id = p_reserva_id) THEN
        UPDATE reservas SET momento_servicio = NULL, hora_servicio = NULL WHERE id = p_reserva_id;
    END IF;

    COMMIT;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- 3) DATOS DE PRUEBA
-- IMPORTANTE: los password_hash son de relleno. Los usuarios reales se
-- crean desde la API (endpoint de registro) para que el hash sea valido.
-- ---------------------------------------------------------------------

INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Administrador', 'admin@claudia.com', 'REEMPLAZAR_HASH', 'admin'),
('Lucia Fernandez', 'lucia@mail.com', 'REEMPLAZAR_HASH', 'cliente'),
('Marcos Diaz', 'marcos@mail.com', 'REEMPLAZAR_HASH', 'cliente'),
('Ana Torres', 'ana@mail.com', 'REEMPLAZAR_HASH', 'cliente');

INSERT INTO restaurantes (nombre, direccion, telefono) VALUES
('La Parrilla del Centro', 'Av. San Martin 450', '3804-123456'),
('Trattoria Bella Vista', 'Belgrano 120', '3804-654321');

INSERT INTO mesas (restaurante_id, numero, capacidad) VALUES
(1, 1, 2), (1, 2, 4), (1, 3, 6),
(2, 1, 2), (2, 2, 4), (2, 3, 8);

-- Reservas de ejemplo (insert directo para poblar el dashboard)
INSERT INTO reservas (usuario_id, mesa_id, fecha, hora, cantidad_personas, estado) VALUES
(2, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '21:00:00', 2, 'confirmada'),
(3, 2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '21:00:00', 4, 'confirmada'),
(2, 3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '20:30:00', 5, 'confirmada'),
(4, 4, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '13:00:00', 2, 'cancelada'),
(3, 5, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '14:00:00', 3, 'confirmada'),
(4, 6, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '21:30:00', 7, 'confirmada'),
(2, 2, DATE_SUB(CURDATE(), INTERVAL 5 DAY), '21:00:00', 4, 'completada');

-- La reserva completada de ejemplo tiene su ingreso, su salida y su cobro
UPDATE reservas
SET llegada_en    = TIMESTAMP(fecha, '21:05:00'),
    finalizada_en = TIMESTAMP(fecha, '22:40:00')
WHERE estado = 'completada';

INSERT INTO pagos (reserva_id, monto, medio_pago, pagado_en, registrado_por)
SELECT id, 18500.00, 'tarjeta', finalizada_en, 1
FROM reservas
WHERE estado = 'completada';

-- Menu de ejemplo
INSERT IGNORE INTO platos (restaurante_id, nombre, descripcion, precio) VALUES
(1, 'Bife de chorizo',      'Con papas rusticas',                  9800.00),
(1, 'Asado para dos',       'Tira, vacio, chorizo y morcilla',    21500.00),
(1, 'Milanesa napolitana',  'Con fritas',                          8600.00),
(1, 'Ensalada mixta',       'Lechuga, tomate y cebolla',           3200.00),
(1, 'Flan casero',          'Con dulce de leche y crema',          3500.00),
(1, 'Gaseosa 500 ml',       '',                                    1800.00),
(1, 'Vino tinto (copa)',    'Malbec',                              2800.00),
(2, 'Ravioles de ricota',   'Con salsa fileto',                    8900.00),
(2, 'Fetuccini al pesto',   'Con parmesano',                       8200.00),
(2, 'Lasagna de carne',     'Gratinada al horno',                  9400.00),
(2, 'Pizza muzzarella',     'Grande, 8 porciones',                 7600.00),
(2, 'Tiramisu',             'Receta de la casa',                   4200.00),
(2, 'Agua mineral',         '',                                    1500.00),
(2, 'Copa de vino blanco',  'Torrontes',                           2700.00);

-- ---------------------------------------------------------------------
-- 4) PRUEBA DE LOS STORED PROCEDURES
-- ---------------------------------------------------------------------
-- Caso OK:
--   CALL sp_crear_reserva(2, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY), '20:00:00', 2, @id);
--   SELECT @id;
-- Caso ROLLBACK (mesa de 2 personas, pido 4):
--   CALL sp_crear_reserva(2, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY), '22:00:00', 4, @id);
-- Caso ROLLBACK (horario ocupado, repetir la primera llamada):
--   CALL sp_crear_reserva(3, 1, DATE_ADD(CURDATE(), INTERVAL 5 DAY), '21:00:00', 2, @id);
--
-- Ingreso del cliente y cobro (la reserva tiene que ser de HOY):
--   CALL sp_registrar_llegada(<id de la reserva>);   -- estado: en_curso, mesa OCUPADA
--   CALL sp_cobrar_reserva(<id>, 15000.00, 'efectivo', 1, @pago);  -- completada, mesa LIBRE
-- Caso ROLLBACK (cobrar sin que el cliente haya llegado):
--   CALL sp_cobrar_reserva(<id de una reserva confirmada>, 15000.00, 'efectivo', 1, @pago);
--
-- Pedido de comida (JSON con plato_id y cantidad):
--   CALL sp_guardar_pedido(<id de reserva>, '[{"plato_id":1,"cantidad":2},{"plato_id":4,"cantidad":1}]');
-- Caso ROLLBACK (plato de otro restaurante):
--   CALL sp_guardar_pedido(<id de reserva del restaurante 1>, '[{"plato_id":8,"cantidad":1}]');

-- ---------------------------------------------------------------------
-- 5) CONSULTAS PARA EL BACKEND (INNER JOIN, GROUP BY, SUBQUERY)
-- ---------------------------------------------------------------------

-- Q1 - INNER JOIN: listado completo de reservas
-- SELECT r.id, u.nombre AS cliente, rest.nombre AS restaurante,
--        m.numero AS mesa, r.fecha, r.hora, r.cantidad_personas, r.estado
-- FROM reservas r
-- INNER JOIN usuarios u      ON u.id = r.usuario_id
-- INNER JOIN mesas m         ON m.id = r.mesa_id
-- INNER JOIN restaurantes rest ON rest.id = m.restaurante_id
-- ORDER BY r.fecha, r.hora;

-- Q2 - GROUP BY + INNER JOIN: reservas y comensales por restaurante
-- SELECT rest.nombre AS restaurante,
--        COUNT(r.id) AS total_reservas,
--        SUM(r.cantidad_personas) AS total_comensales
-- FROM restaurantes rest
-- INNER JOIN mesas m    ON m.restaurante_id = rest.id
-- INNER JOIN reservas r ON r.mesa_id = m.id
-- WHERE r.estado <> 'cancelada'
-- GROUP BY rest.id, rest.nombre
-- ORDER BY total_reservas DESC;

-- Q3 - SUBCONSULTA: clientes con mas reservas que el promedio
-- SELECT u.nombre, COUNT(r.id) AS reservas
-- FROM usuarios u
-- INNER JOIN reservas r ON r.usuario_id = u.id
-- GROUP BY u.id, u.nombre
-- HAVING COUNT(r.id) > (
--     SELECT AVG(cant) FROM (
--         SELECT COUNT(*) AS cant FROM reservas GROUP BY usuario_id
--     ) AS t
-- );

-- Q4 - mesas libres en una fecha y hora dada (para el buscador).
--      Usa la funcion fn_conflictos_mesa, que consulta las reservas de la mesa.
-- SELECT m.id, m.numero, m.capacidad
-- FROM mesas m
-- WHERE m.restaurante_id = 1 AND m.activa = TRUE
--   AND fn_conflictos_mesa(m.id, TIMESTAMP('2026-11-01', '21:00:00'), 0) = 0;

-- Q5 - INNER JOIN + GROUP BY: ingresos por medio de pago
-- SELECT medio_pago, COUNT(*) AS cantidad, SUM(monto) AS total
-- FROM pagos
-- GROUP BY medio_pago
-- ORDER BY total DESC;
