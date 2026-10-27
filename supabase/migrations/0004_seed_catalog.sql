-- DEMO catalog. Names, prices and stock are placeholders, not real SuperWalls products.
-- Re-running only refreshes sort_order; it never resets live stock or edited prices.
insert into public.products
  (id, name, tagline, description, price_paise, compare_at_price_paise, unit, images, stock, is_demo, sort_order)
values
  ('demo-floor-cleaner', 'Demo Floor Cleaner', 'Everyday floor care',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   19900, 24900, '1 L', '[{"src":"/products/floor-cleaner.svg","alt":"Demo floor cleaner bottle"}]', 40, true, 1),
  ('demo-glass-cleaner', 'Demo Glass Cleaner', 'Windows and mirrors',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   14900, null, '500 mL', '[{"src":"/products/glass-cleaner.svg","alt":"Demo glass cleaner spray bottle"}]', 25, true, 2),
  ('demo-bathroom-cleaner', 'Demo Bathroom Cleaner', 'Tiles and fittings',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   17900, 21900, '750 mL', '[{"src":"/products/bathroom-cleaner.svg","alt":"Demo bathroom cleaner bottle"}]', 3, true, 3),
  ('demo-dishwash-liquid', 'Demo Dishwash Liquid', 'Kitchen essentials',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   12900, null, '500 mL', '[{"src":"/products/dishwash-liquid.svg","alt":"Demo dishwash liquid pump bottle"}]', 60, true, 4),
  ('demo-disinfectant-spray', 'Demo Disinfectant Spray', 'Quick surface spray',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   24900, 29900, '400 mL', '[{"src":"/products/disinfectant-spray.svg","alt":"Demo disinfectant spray can"}]', 0, true, 5),
  ('demo-microfibre-cloths', 'Demo Microfibre Cloth Pack', 'Reusable cloths',
   'Placeholder product for the demo storefront. Real product details, ingredients and usage instructions will appear here once the catalog is provided.',
   9900, null, 'Pack of 3', '[{"src":"/products/microfibre-cloths.svg","alt":"Demo pack of three microfibre cloths"}]', 80, true, 6)
on conflict (id) do update set sort_order = excluded.sort_order;
