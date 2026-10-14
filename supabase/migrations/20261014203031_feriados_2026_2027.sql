-- Feriados 2026 y 2027 (D-16). La tabla estaba vacía: los feriados contaban
-- como días hábiles para "viejo" y para "Todavía no cargaste hoy".
--
-- Qué es cada mercado:
-- - 'AR': días de semana sin rueda en BYMA. Los días en que BYMA negocia
--   aunque no liquide (bancos cerrados) no van: ese día hay precios nuevos.
-- - 'US': días de semana en que cierra la NYSE (el subyacente de los CEDEAR).
-- Sábados y domingos no se cargan: ya no son hábiles.
--
-- Fuentes oficiales, consultadas el 14/10/2026. Los sitios no abren desde el
-- entorno de desarrollo, así que se leyeron con un buscador:
-- - Ley 27.399, arts. 1 (inamovibles y trasladables) y 6 (un trasladable que
--   cae martes o miércoles pasa al lunes anterior; jueves o viernes, al lunes
--   siguiente). Las fechas de Carnaval y Viernes Santo salen de la Pascua.
--   https://www.argentina.gob.ar/normativa/nacional/ley-27399-281835/texto
-- - DNU 1103/2026 (BO 28/09/2026): feriado nacional el lun 9/11/2026 por la
--   visita del papa León XIV; el 10/11, solo en Córdoba y CABA; el 11/11, solo
--   en la provincia de Buenos Aires.
--   https://www.boletinoficial.gob.ar/detalleAviso/primera/348022/20260928
-- - Resolución JGM 164/2025: no laborables con fines turísticos 2026 (23/3,
--   10/7 y 7/12).
--   https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-164-2025-421799/texto
-- - BCRA, feriados bancarios 2026 (Com. "C" 101352; Com. "A" 8487: el 10/11/2026
--   es feriado bancario en todo el país).
--   https://www.bcra.gob.ar/en/consult-national-holiday-2026/
-- - BYMA, Calendario Bursátil 2026. Nota (3), "Day without Settlement | Trading
--   Session": 23/3, 6/11 (Día del Bancario), 7/12 y 24/12. El 31/12 va "Day
--   without Trading or Settlement" (4), con el criterio del Comunicado 18897.
--   https://www.byma.com.ar/en/market/calendario-bursatil
-- - NYSE, Holidays & Trading Hours, y el anuncio de ICE "NYSE Group Announces
--   2026, 2027 and 2028 Holiday and Early Closings Calendar".
--   https://www.nyse.com/markets/hours-calendars
--
-- Quedan afuera, hasta poder confirmarlos:
-- - AR 2026: el 10/7 (no laborable; BYMA le pone otra nota y no dice si
--   negoció), el 10/11 y el 11/11 (BYMA todavía no publicó cómo opera).
-- - AR 2027: Jueves Santo (25/3), el 20/11 (cae sábado; el Decreto 614/2025
--   deja pasarlo al viernes 19 o al lunes 22 y falta que se fije), los no
--   laborables con fines turísticos (no se fijaron) y el 31/12 (BYMA no
--   publicó el calendario 2027).
-- - US: los cierres temprano (27/11/2026, 24/12/2026 y 26/11/2027) son días
--   con rueda.
--
-- Solo agrega filas: si alguna ya existe, queda como está. Cada alta pasa por
-- la auditoría. Control: supabase/tests/schema_tests.sql ("feriados: …").

insert into feriados (mercado, fecha, descripcion) values
  -- Argentina 2026
  ('AR', '2026-01-01', 'Año Nuevo'),
  ('AR', '2026-02-16', 'Carnaval'),
  ('AR', '2026-02-17', 'Carnaval'),
  ('AR', '2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
  ('AR', '2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas (y Jueves Santo)'),
  ('AR', '2026-04-03', 'Viernes Santo'),
  ('AR', '2026-05-01', 'Día del Trabajador'),
  ('AR', '2026-05-25', 'Día de la Revolución de Mayo'),
  ('AR', '2026-06-15', 'Paso a la Inmortalidad del General Martín Miguel de Güemes (trasladado del 17/6)'),
  ('AR', '2026-07-09', 'Día de la Independencia'),
  ('AR', '2026-08-17', 'Paso a la Inmortalidad del General José de San Martín'),
  ('AR', '2026-10-12', 'Día del Respeto a la Diversidad Cultural'),
  ('AR', '2026-11-09', 'Visita del papa León XIV (feriado nacional, DNU 1103/2026)'),
  ('AR', '2026-11-23', 'Día de la Soberanía Nacional (trasladado del 20/11)'),
  ('AR', '2026-12-08', 'Día de la Inmaculada Concepción de María'),
  ('AR', '2026-12-25', 'Navidad'),
  ('AR', '2026-12-31', 'BYMA no negocia ni liquida (calendario bursátil)'),
  -- Argentina 2027 (Ley 27.399)
  ('AR', '2027-01-01', 'Año Nuevo'),
  ('AR', '2027-02-08', 'Carnaval'),
  ('AR', '2027-02-09', 'Carnaval'),
  ('AR', '2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'),
  ('AR', '2027-03-26', 'Viernes Santo'),
  ('AR', '2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'),
  ('AR', '2027-05-25', 'Día de la Revolución de Mayo'),
  ('AR', '2027-06-21', 'Paso a la Inmortalidad del General Martín Miguel de Güemes (trasladado del 17/6)'),
  ('AR', '2027-07-09', 'Día de la Independencia'),
  ('AR', '2027-08-16', 'Paso a la Inmortalidad del General José de San Martín (trasladado del 17/8)'),
  ('AR', '2027-10-11', 'Día del Respeto a la Diversidad Cultural (trasladado del 12/10)'),
  ('AR', '2027-12-08', 'Día de la Inmaculada Concepción de María'),
  -- Estados Unidos 2026 (NYSE)
  ('US', '2026-01-01', 'Año Nuevo'),
  ('US', '2026-01-19', 'Día de Martin Luther King Jr.'),
  ('US', '2026-02-16', 'Día de los Presidentes (Washington''s Birthday)'),
  ('US', '2026-04-03', 'Viernes Santo'),
  ('US', '2026-05-25', 'Día de los Caídos (Memorial Day)'),
  ('US', '2026-06-19', 'Juneteenth'),
  ('US', '2026-07-03', 'Día de la Independencia (se observa el viernes 3/7)'),
  ('US', '2026-09-07', 'Día del Trabajo (Labor Day)'),
  ('US', '2026-11-26', 'Día de Acción de Gracias'),
  ('US', '2026-12-25', 'Navidad'),
  -- Estados Unidos 2027 (NYSE)
  ('US', '2027-01-01', 'Año Nuevo'),
  ('US', '2027-01-18', 'Día de Martin Luther King Jr.'),
  ('US', '2027-02-15', 'Día de los Presidentes (Washington''s Birthday)'),
  ('US', '2027-03-26', 'Viernes Santo'),
  ('US', '2027-05-31', 'Día de los Caídos (Memorial Day)'),
  ('US', '2027-06-18', 'Juneteenth (se observa el viernes 18/6)'),
  ('US', '2027-07-05', 'Día de la Independencia (se observa el lunes 5/7)'),
  ('US', '2027-09-06', 'Día del Trabajo (Labor Day)'),
  ('US', '2027-11-25', 'Día de Acción de Gracias'),
  ('US', '2027-12-24', 'Navidad (se observa el viernes 24/12)')
on conflict (mercado, fecha) do nothing;
