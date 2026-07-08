insert into public.expense_categories(name) values
  ('Telecomunicaciones'),('Transporte y última milla'),('Arriendos'),('Servicios básicos'),('Equipamiento'),('Honorarios'),('Operación'),('Otros')
on conflict(name) do nothing;
insert into public.cost_centers(name,code) values
  ('Operación de red','RED'),('Administración','ADM'),('Comercial','COM'),('Soporte técnico','SOP')
on conflict(name) do nothing;
