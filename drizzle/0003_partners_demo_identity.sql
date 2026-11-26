ALTER TABLE demo_slots ADD COLUMN visitor_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX demo_slots_visitor ON demo_slots(visitor_id);
--> statement-breakpoint
CREATE TABLE trusted_partners (id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, category TEXT NOT NULL, services TEXT NOT NULL DEFAULT '');
--> statement-breakpoint
INSERT INTO trusted_partners(id,name,city,category,services) VALUES
 ('dolina','Dolina avto tur','Узбекистан','transport','Автобусы Bonluck 53 места; Yutong 51 место, Wi-Fi; Asia Star 51 место; Toyota Hiace 13 мест; Hyundai Staria VIP 8 мест; Mercedes Sprinter VIP 5 мест'),
 ('asia-luxe','Asia Luxe','Хорезм','hotel',''),
 ('hotel-orient','Hotel Orient','Самарканд','hotel',''),
 ('hotel-astoria','Hotel Astoria','Самарканд','hotel',''),
 ('rocco-forte','Rocco Forte Hotel','Самарканд','hotel',''),
 ('praga-hotel','Praga Hotel','Кашкадарья','hotel',''),
 ('trawelko','TRAWELKO','Наманган','partner','');
