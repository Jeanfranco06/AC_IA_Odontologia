/* Pruebas de reglas con datos locales de sesion. No cambian las bases.
   Complementan, NO sustituyen, ejecutar el ETL dos veces y 02_validacion.sql.
   Ejecucion local documentada en docs/CIERRE_BUYER_Y_VALIDACION_LOCAL.md.
*/
SET NOCOUNT ON;
DECLARE @casos TABLE (
    caso VARCHAR(80),captacion DATETIME2(7),conversion DATETIME2(7),
    utilizable BIT,esperado INT
);
INSERT @casos VALUES
('Sin conversion','20260101',NULL,1,0),
('Catorce dias exactos','20260101','20260115',1,1),
('Catorce dias y un segundo','20260101','20260115 00:00:01',1,0),
('Un segundo antes del limite','20260101','20260114 23:59:59',1,1),
('Cronologia negativa','20260102','20260101',1,0),
('Sin autorizacion utilizable','20260101','20260102',0,0);
SELECT caso,esperado,
       CASE WHEN utilizable=1 AND conversion>=captacion
                 AND conversion<=DATEADD(DAY,14,captacion)
            THEN 1 ELSE 0 END AS obtenido
FROM @casos;
IF EXISTS (
    SELECT 1 FROM @casos WHERE esperado<>
        CASE WHEN utilizable=1 AND conversion>=captacion
                  AND conversion<=DATEADD(DAY,14,captacion)
             THEN 1 ELSE 0 END
)
    THROW 51300,'Fallo en reglas temporales/autorizacion de B1.',1;

-- Un sol entre tres contactos debe sumar exactamente un sol, no 0.99.
DECLARE @contactos TABLE (id_persona INT PRIMARY KEY);
INSERT @contactos VALUES (10),(20),(30);
DECLARE @centimos BIGINT=100,@cantidad BIGINT=(SELECT COUNT(*) FROM @contactos);
DECLARE @asignados TABLE (id_persona INT PRIMARY KEY,centimos BIGINT);
INSERT @asignados
SELECT c.id_persona,@centimos/@cantidad+
       CASE WHEN (SELECT COUNT(*) FROM @contactos c2 WHERE c2.id_persona<=c.id_persona)
                     <=@centimos%@cantidad THEN 1 ELSE 0 END
FROM @contactos c;
SELECT id_persona,centimos FROM @asignados ORDER BY id_persona;
DECLARE @total BIGINT=(SELECT SUM(centimos) FROM @asignados);
IF @total<>@centimos THROW 51301,'No se conservaron los centimos de gasto.',1;
PRINT 'Reglas de ventana y conservacion de centimos: correctas en esta sesion.';
