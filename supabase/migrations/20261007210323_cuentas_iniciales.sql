-- Cuentas del dueño y cómo llega la información de cada una (D-10).
insert into cuentas (nombre, tipo, formato_carga) values
  ('IEB',          'broker',    'excel_ieb'),
  ('Galicia',      'banco',     'captura'),
  ('Mercado Pago', 'billetera', 'captura');
