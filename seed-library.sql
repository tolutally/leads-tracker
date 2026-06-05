insert into tags (kind, label) values
  ('angle','Automated tracking through placement'),
  ('angle','Career prep that scales'),
  ('angle','More capacity, same team'),
  ('angle','Outcomes proof for funders'),
  ('angle','Cross-program visibility'),
  ('problem','Manual work burning out staff'),
  ('problem','Scattered, unreliable tracking'),
  ('problem','Placement handoff gaps'),
  ('problem','Can''t prove outcomes to funders')
on conflict (kind, label) do nothing;
