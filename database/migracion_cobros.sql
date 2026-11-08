-- =====================================================================
-- MIGRACION: ingreso del cliente, cobro y mesa libre al pagar
--
-- Para la base reservas_db que YA esta cargada (no borra tus datos).
-- Ejecutar UNA SOLA VEZ en MySQL Workbench: File > Open SQL Script,
-- elegir este archivo y tocar el rayito.
-- Si preferis empezar de cero, ejecuta en cambio reservas_db.sql completo.
-- =====================================================================

USE reservas_db;

ALTER TABLE reservas
    MODIFY estado ENUM('confirmada', 'cancelada', 'completada', 'en_curso')
                  NOT NULL DEFAULT 'confirmada',
    ADD COLUMN llegada_en    DATETIME NULL AFTER estado,
    ADD COLUMN finalizada_en DATETIME NULL AFTER llegada_en;

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

DROP FUNCTION IF EXISTS fn_minutos_estimados$$

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
DROP FUNCTION IF EXISTS fn_conflictos_mesa$$

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

DROP PROCEDURE IF EXISTS sp_crear_reserva$$

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
DROP PROCEDURE IF EXISTS sp_modificar_reserva$$

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
DROP PROCEDURE IF EXISTS sp_registrar_llegada$$

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
DROP PROCEDURE IF EXISTS sp_cobrar_reserva$$

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

DELIMITER ;
