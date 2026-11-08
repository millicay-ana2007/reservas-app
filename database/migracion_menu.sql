-- =====================================================================
-- MIGRACION: menu de platos, pedido de comida y horario de servicio
--
-- Para la base reservas_db que YA esta cargada (no borra tus datos).
-- Se puede ejecutar mas de una vez sin error.
-- Ejecutar en MySQL Workbench: File > Open SQL Script, elegir este archivo
-- y tocar el rayito. Requiere haber aplicado antes migracion_cobros.sql
-- (o haber cargado reservas_db.sql completo).
-- =====================================================================

USE reservas_db;

-- 1) Columnas nuevas en reservas (solo si todavia no existen)
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_tmp_migrar_menu$$

CREATE PROCEDURE sp_tmp_migrar_menu()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservas'
                     AND COLUMN_NAME = 'momento_servicio') THEN
        ALTER TABLE reservas
            ADD COLUMN momento_servicio ENUM('al_entrar', 'min_10', 'min_20', 'personalizado') NULL AFTER finalizada_en,
            ADD COLUMN hora_servicio    TIME NULL AFTER momento_servicio,
            ADD CONSTRAINT ck_reserva_servicio
                CHECK (momento_servicio IS NULL OR ((momento_servicio = 'personalizado') = (hora_servicio IS NOT NULL)));
    END IF;
END$$

CALL sp_tmp_migrar_menu()$$
DROP PROCEDURE sp_tmp_migrar_menu$$

DELIMITER ;

-- 2) Tablas nuevas
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

-- 3) Stored procedure con transaccion
DELIMITER $$

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

-- 4) Platos de ejemplo (INSERT IGNORE: no duplica si ya estan)
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
