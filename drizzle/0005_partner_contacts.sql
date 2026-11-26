ALTER TABLE trusted_partners ADD COLUMN contacts TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
UPDATE trusted_partners SET contacts='{"phones":["+998 97 271 11 10","+998 91 115 11 10"],"email":"nosirbek_1110@gmail.com","telegram":"dolinaavtotur"}' WHERE id='dolina';
--> statement-breakpoint
UPDATE trusted_partners SET contacts='{"phones":["1111","+998 71 201 77 77"],"email":"info@asialuxe.uz"}' WHERE id='asia-luxe';
--> statement-breakpoint
UPDATE trusted_partners SET contacts='{"phones":["+998 66 232 10 19","+998 66 232 01 31","+998 97 579 94 99","+998 97 392 40 10"],"email":"hotel@tour-orient.com","telegram":"orientstarhotels"}' WHERE id='hotel-orient';
--> statement-breakpoint
UPDATE trusted_partners SET city='Ташкент', contacts='{"phones":["+998 94 624 51 00"],"email":"astoriaboutiquehoteltashkent@gmail.com"}' WHERE id='hotel-astoria';
--> statement-breakpoint
UPDATE trusted_partners SET city='Ташкент', contacts='{"phones":["+998 71 205 02 17"],"email":"pragahotel2019@gmail.com"}' WHERE id='praga-hotel';
--> statement-breakpoint
UPDATE trusted_partners SET contacts='{"phones":["+998 88 155 47 27"]}' WHERE id='trawelko';
