INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:registan','Registan Way','both','Самарканд','Туры по Самарканду и Шахрисабзу, свои гиды на 6 языках, 12 лет на рынке.',1);
--> statement-breakpoint
INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:zarafshon','Zarafshon Trips','both','Самарканд','Групповые туры, гостиницы 3–4★, трансферы с вокзала и аэропорта.',1);
--> statement-breakpoint
INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:karvon','Buxoro Karvon','both','Бухара','Туры по Бухаре и Нурате, юрточный лагерь, свой транспорт.',1);
--> statement-breakpoint
INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:darvoza','Darvoza Tours','both','Хива','Хива и крепости Хорезма, гиды на английском и немецком.',1);
--> statement-breakpoint
INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:ekspress','Toshkent Ekspress Avto','both','Ташкент','Автобусы и минивэны 13–53 места, кондиционер, Wi-Fi, междугородние рейсы.',1);
--> statement-breakpoint
INSERT INTO profiles(id,name,role,city,about,demo) VALUES('demo:gidlar','Gidlar Uyi','both','Ташкент','Лицензированные гиды на английском, испанском, французском и китайском.',1);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-1','demo:registan','Navbahor Travel',5,'Взяли нашу группу из 22 человек в высокий сезон, всё чётко по программе.',(CAST(strftime('%s','now') AS INTEGER)-518400)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-2','demo:registan','Orzu Tour',5,'Гид на французском — отличный, туристы оставили хорошие отзывы.',(CAST(strftime('%s','now') AS INTEGER)-1036800)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-3','demo:registan','Samo Trip',5,'Работаем третий сезон, ни одного срыва.',(CAST(strftime('%s','now') AS INTEGER)-1555200)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-4','demo:registan','Yulduz Travel',4,'Хорошо, но гостиницу подтвердили только за день.',(CAST(strftime('%s','now') AS INTEGER)-2073600)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-5','demo:registan','Bahor Line',5,'Быстро ответили и дали лучшую цену.',(CAST(strftime('%s','now') AS INTEGER)-2592000)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-6','demo:zarafshon','Orzu Tour',5,'Удобно: и гостиница, и трансфер в одном месте.',(CAST(strftime('%s','now') AS INTEGER)-3110400)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-7','demo:zarafshon','Navbahor Travel',4,'Всё хорошо, автобус немного опоздал на вокзал.',(CAST(strftime('%s','now') AS INTEGER)-3628800)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-8','demo:zarafshon','Kamalak Tour',5,'Отличное соотношение цены и качества.',(CAST(strftime('%s','now') AS INTEGER)-4147200)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-9','demo:karvon','Samo Trip',5,'Юрточный лагерь в Нурате — туристы в восторге.',(CAST(strftime('%s','now') AS INTEGER)-4665600)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-10','demo:karvon','Bahor Line',5,'Надёжные, берут группы даже в последний момент.',(CAST(strftime('%s','now') AS INTEGER)-5184000)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-11','demo:karvon','Kamalak Tour',4,'Хорошая программа, обеды можно разнообразить.',(CAST(strftime('%s','now') AS INTEGER)-5702400)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-12','demo:karvon','Yulduz Travel',5,'Рекомендуем.',(CAST(strftime('%s','now') AS INTEGER)-6220800)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-13','demo:darvoza','Navbahor Travel',5,'Гид на немецком — профессионал.',(CAST(strftime('%s','now') AS INTEGER)-6739200)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-14','demo:darvoza','Orzu Tour',4,'Всё по договорённости.',(CAST(strftime('%s','now') AS INTEGER)-7257600)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-15','demo:ekspress','Registan Way',5,'Дали автобус за 3 часа, когда наш сломался в дороге.',(CAST(strftime('%s','now') AS INTEGER)-7776000)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-16','demo:ekspress','Samo Trip',5,'Новые автобусы, водители вежливые.',(CAST(strftime('%s','now') AS INTEGER)-8294400)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-17','demo:ekspress','Kamalak Tour',5,'Wi-Fi и кондиционер реально работают.',(CAST(strftime('%s','now') AS INTEGER)-8812800)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-18','demo:ekspress','Bahor Line',4,'Хорошо, но нужен заказ хотя бы за день.',(CAST(strftime('%s','now') AS INTEGER)-9331200)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-19','demo:ekspress','Orzu Tour',5,'Постоянный партнёр.',(CAST(strftime('%s','now') AS INTEGER)-9849600)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-20','demo:ekspress','Yulduz Travel',5,'Отлично.',(CAST(strftime('%s','now') AS INTEGER)-10368000)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-21','demo:gidlar','Darvoza Tours',5,'Нашли гида на испанском за вечер.',(CAST(strftime('%s','now') AS INTEGER)-10886400)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-22','demo:gidlar','Navbahor Travel',5,'Гиды подготовленные, знают историю.',(CAST(strftime('%s','now') AS INTEGER)-11404800)*1000);
--> statement-breakpoint
INSERT INTO reviews(id,target,author,rating,text,created) VALUES('demo-review-23','demo:gidlar','Samo Trip',4,'Хорошо, чуть дороже рынка.',(CAST(strftime('%s','now') AS INTEGER)-11923200)*1000);
--> statement-breakpoint
INSERT INTO jobs(id,owner,text,data,created) VALUES('00000000-0000-4000-8000-000000000001','demo:zarafshon','Нужен автобус на 50 мест Самарканд → Бухара на 2 дня, 5 декабря, с кондиционером','{"title": "Автобус на 50 мест, Самарканд → Бухара", "service": "transport", "city": "Бухара", "from": "Самарканд", "start": "2026-12-05", "days": 2, "groups": 1, "people": 46, "language": "", "hotel": "", "meals": "", "transport": "Автобус 50 мест, кондиционер", "budget": "", "details": ["Выезд утром 5 декабря", "Кондиционер обязателен", "Ночёвка водителя в Бухаре — за наш счёт"]}',(CAST(strftime('%s','now') AS INTEGER)-9000)*1000);
--> statement-breakpoint
INSERT INTO jobs(id,owner,text,data,created) VALUES('00000000-0000-4000-8000-000000000002','demo:darvoza','Срочно гид на испанском в Хиве на 3 дня, группа 18 человек, с 8 декабря','{"title": "Гид на испанском в Хиве на 3 дня", "service": "guide", "city": "Хива", "from": "", "start": "2026-12-08", "days": 3, "groups": 1, "people": 18, "language": "испанский", "hotel": "", "meals": "", "transport": "", "budget": "", "details": ["Группа 18 человек из Испании", "Ичан-Кала и крепости Элликкалы", "Нужен опыт работы с группами"]}',(CAST(strftime('%s','now') AS INTEGER)-17000)*1000);
--> statement-breakpoint
INSERT INTO jobs(id,owner,text,data,created) VALUES('00000000-0000-4000-8000-000000000003','demo:karvon','Гостиница 3* в Бухаре на 2 ночи, 24 человека, 12 двухместных номеров, с завтраком','{"title": "Гостиница 3★ в Бухаре на 2 ночи, 24 человека", "service": "hotel", "city": "Бухара", "from": "", "start": "2026-12-10", "days": 2, "groups": 1, "people": 24, "language": "", "hotel": "3★", "meals": "Завтраки", "transport": "", "budget": "до $45 за номер", "details": ["12 двухместных номеров", "Желательно у Ляби-Хауза", "Парковка для автобуса"]}',(CAST(strftime('%s','now') AS INTEGER)-26000)*1000);
--> statement-breakpoint
INSERT INTO jobs(id,owner,text,data,created) VALUES('00000000-0000-4000-8000-000000000004','demo:registan','Возьмите группу 15 человек на 5 дней Ташкент + Самарканд, гид на английском, 3*','{"title": "Тур Ташкент + Самарканд на 5 дней, 15 человек", "service": "tour", "city": "Самарканд", "from": "Ташкент", "start": "2026-12-14", "days": 5, "groups": 1, "people": 15, "language": "английский", "hotel": "3★", "meals": "Завтраки и ужины", "transport": "", "budget": "", "details": ["Гид на английском все дни", "Скоростной поезд Afrosiyob туда и обратно", "Гостиницы 3★ в центре"]}',(CAST(strftime('%s','now') AS INTEGER)-41000)*1000);
