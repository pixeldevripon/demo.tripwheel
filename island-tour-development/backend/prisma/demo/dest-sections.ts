// DEMO SEED - the three "About tours in {island}" sections, in all 7 locales.
//
// These are authored CMS rows (PageContentSection), not dictionary strings,
// because the copy names real places on each island. Kept in their own file
// rather than in i18n-templates.ts: it is 21 long-form paragraphs and it would
// have doubled that file.
//
// ## How one sentence set covers five islands
//
// Everything interpolated below is a PROPER NOUN or a NUMBER - both identical in
// every language. That is what lets one hand-written paragraph per locale
// produce genuinely island-specific copy for all five islands, the same trick
// CATEGORY_NAME_I18N plays for category labels. Nothing that needs translating
// (compass directions, month names, descriptive phrases) is ever a fact field:
// those live in the localized sentences themselves.
//
// The one island property that changes the SENTENCE rather than a word is
// `outsideHurricaneBelt`, so each locale supplies both clauses. Curacao and Aruba
// sit below the belt; Sint Maarten, Saint Lucia and the Bahamas do not, and
// claiming otherwise would be a factual error on a page that sells trust.

import { Locale } from '@prisma/client';

export type IslandFacts = {
  /** The island's signature boat trip or landmark. */
  signature: string;
  /** Crossing time to `signature`, one way: [min, max] minutes. */
  crossing: [number, number];
  /** Main town / arrival point. */
  gateway: string;
  /** Where cruise passengers actually step ashore. */
  quays: string;
  /** Sheltered, calm-water spot - the easy first day. */
  calmSpot: string;
  /** Inland or rugged counterpart - the dust-and-horsepower day. */
  landSpot: string;
  /** Best-known reef / snorkel site. */
  nature: string;
  /** Boat days typically leave before this local time. */
  departBy: string;
  /** Below the hurricane belt (ABC islands) - changes the season sentence. */
  outsideHurricaneBelt: boolean;
};

/** Keyed by destination slug (see the destination list in prisma/seed.ts). */
export const ISLAND_FACTS: Record<string, IslandFacts> = {
  curacao: {
    signature: 'Klein Curaçao',
    crossing: [45, 105],
    gateway: 'Willemstad',
    quays: 'the Willemstad quays',
    calmSpot: 'Playa Piskado',
    landSpot: 'Christoffel National Park',
    nature: 'the Blue Room cave',
    departBy: '7:00',
    outsideHurricaneBelt: true,
  },
  aruba: {
    signature: 'the Antilla wreck',
    crossing: [20, 45],
    gateway: 'Oranjestad',
    quays: 'the Oranjestad cruise terminal',
    calmSpot: 'Eagle Beach',
    landSpot: 'Arikok National Park',
    nature: 'Baby Beach',
    departBy: '8:00',
    outsideHurricaneBelt: true,
  },
  'sint-maarten': {
    signature: 'Tintamarre',
    crossing: [30, 60],
    gateway: 'Philipsburg',
    quays: 'the Philipsburg boardwalk',
    calmSpot: 'Mullet Bay',
    landSpot: 'Loterie Farm',
    nature: 'Creole Rock',
    departBy: '8:30',
    outsideHurricaneBelt: false,
  },
  'saint-lucia': {
    signature: 'the Pitons',
    crossing: [45, 90],
    gateway: 'Castries',
    quays: 'the Castries waterfront',
    calmSpot: 'Marigot Bay',
    landSpot: 'Sulphur Springs',
    nature: 'Anse Chastanet',
    departBy: '8:00',
    outsideHurricaneBelt: false,
  },
  bahamas: {
    signature: 'the Exuma Cays',
    crossing: [60, 120],
    gateway: 'Nassau',
    quays: 'Prince George Wharf',
    calmSpot: 'Blue Lagoon Island',
    landSpot: 'Clifton Heritage Park',
    nature: 'Rose Island',
    departBy: '7:30',
    outsideHurricaneBelt: false,
  },
};

/**
 * Identity of the three sections, shared by every locale. `destSections` returns
 * heading + body INDEX-ALIGNED with this array (the same convention the FAQ sets
 * use), so the seed pairs them up without threading keys through translations.
 *
 * No `anchor`: the design has these as three columns of copy, not in-page links
 * (user, 2026-07-21). `dictKey` names the bundled `destination.about.*` label
 * each block replaces, which is what the frontend falls back to when an island
 * has no authored rows.
 */
export const DEST_SECTIONS = [
  { key: 'top-things', dictKey: 'topThings' },
  { key: 'planning', dictKey: 'planning' },
  { key: 'why-book', dictKey: 'whyBook' },
] as const;

export type Section = { heading: string; body: string };

type SectionBuilder = (name: string, f: IslandFacts) => Section[];

export const DEST_SECTIONS_I18N: Record<Locale, SectionBuilder> = {
  // ── English ─────────────────────────────────────────────────────────────────
  [Locale.en]: (n, f) => [
    {
      heading: 'Top things to do',
      body: `${f.signature} is the trip people fly home talking about: a crossing of ${f.crossing[0]} to ${f.crossing[1]} minutes from ${f.gateway}, and a shoreline that outruns every photo of it. Catamarans, motorboats and speedboats make the run daily. Closer in, ${f.calmSpot} is calm-water territory - snorkel bays, sheltered coves and easy beach-hopping - and ${f.nature} is the reef everyone asks about. Inland, ${f.landSpot} answers with dust and horsepower on buggy and quad trails. In between sit sunset sails and jet ski runs past the ${f.gateway} waterfront. First visit? Start with one boat day, one land day, and one sunset.`,
    },
    {
      heading: 'Planning your trip',
      body: `Boat days to ${f.signature} leave early, usually before ${f.departBy}, and are back before dinner; sunset cruises run 2.5 to 3 hours, and most land tours fit inside an afternoon. ${
        f.outsideHurricaneBelt
          ? `${n} sits south of the hurricane belt and the trade wind keeps the heat workable, so tours run year-round.`
          : `${n} runs tours year-round, with the calmest, driest stretch from December to May.`
      } December to April is high season and the popular boats fill first: book those a few days ahead, and further out around holidays. Arriving by cruise ship? Check a tour's meeting point against your terminal before you book; many departures are minutes from ${f.quays}. Every price you see includes taxes and fees, and a deposit is usually all it takes to hold your spot.`,
    },
    {
      heading: 'Why book with Island Tours',
      body: `Island Tours is built on ${n} by people who grew up here. We don't list everything; we pick the operators we would put our own family on, ride the tours ourselves, and write every description from experience. The price you see is the full price. Most tours reserve with a small deposit, so you are not paying for the whole holiday up front, and every tour can be cancelled for free - no forms, no questions asked - with the exact cut-off on each tour page. And when you are standing on a dock at 6:45 wondering where the boat is, we answer on WhatsApp, 08:00 to 20:00, from the same island you are calling about.`,
    },
  ],

  // ── Nederlands ──────────────────────────────────────────────────────────────
  [Locale.nl]: (n, f) => [
    {
      heading: 'Top dingen om te doen',
      body: `${f.signature} is de tocht waar mensen thuis nog over praten: een overtocht van ${f.crossing[0]} tot ${f.crossing[1]} minuten vanaf ${f.gateway}, en een kustlijn die mooier is dan elke foto ervan. Catamarans, motorboten en speedboten varen er dagelijks heen. Dichterbij is ${f.calmSpot} rustig-watergebied - snorkelbaaien, beschutte inhammen en makkelijk strandhoppen - en ${f.nature} is het rif waar iedereen naar vraagt. Landinwaarts biedt ${f.landSpot} stof en pk's op buggy- en quadroutes. Daartussen liggen zonsondergangzeiltochten en jetskiritten langs de boulevard van ${f.gateway}. Eerste keer? Begin met één bootdag, één landdag en één zonsondergang.`,
    },
    {
      heading: 'Plan je reis',
      body: `Bootdagen naar ${f.signature} vertrekken vroeg, meestal voor ${f.departBy}, en zijn terug voor het avondeten; zonsondergangcruises duren 2,5 tot 3 uur en de meeste landtours passen in een middag. ${
        f.outsideHurricaneBelt
          ? `${n} ligt onder de orkaangordel en de passaatwind houdt de hitte draaglijk, dus er varen het hele jaar door tours.`
          : `Op ${n} lopen tours het hele jaar door, met de rustigste en droogste periode van december tot mei.`
      } December tot april is hoogseizoen en de populaire boten zitten het eerst vol: boek die een paar dagen van tevoren, en ruimer rond de feestdagen. Kom je met een cruiseschip? Vergelijk het vertrekpunt van een tour met je terminal voordat je boekt; veel vertrekken liggen op enkele minuten van ${f.quays}. Elke prijs die je ziet is inclusief belastingen en toeslagen, en meestal volstaat een aanbetaling om je plek vast te leggen.`,
    },
    {
      heading: 'Waarom boeken bij Island Tours',
      body: `Island Tours is opgebouwd op ${n} door mensen die hier zijn opgegroeid. We plaatsen niet alles; we kiezen de aanbieders waar we onze eigen familie naartoe zouden sturen, gaan zelf mee en schrijven elke beschrijving vanuit ervaring. De prijs die je ziet is de volledige prijs. Bij de meeste tours reserveer je met een kleine aanbetaling, dus je betaalt niet je hele vakantie vooruit, en elke tour is gratis te annuleren - geen formulieren, geen vragen - met de exacte termijn op elke tourpagina. En sta je om 6:45 op de kade je af te vragen waar de boot blijft, dan antwoorden wij via WhatsApp, van 08:00 tot 20:00, vanaf hetzelfde eiland als waar je over belt.`,
    },
  ],

  // ── Deutsch ─────────────────────────────────────────────────────────────────
  [Locale.de]: (n, f) => [
    {
      heading: 'Top-Aktivitäten',
      body: `${f.signature} ist der Ausflug, von dem man zu Hause noch erzählt: eine Überfahrt von ${f.crossing[0]} bis ${f.crossing[1]} Minuten ab ${f.gateway} und eine Küste, die jedes Foto von ihr übertrifft. Katamarane, Motor- und Schnellboote fahren täglich hinaus. Näher gelegen ist ${f.calmSpot} ruhiges Wasser - Schnorchelbuchten, geschützte Winkel und entspanntes Strandhüpfen -, und ${f.nature} ist das Riff, nach dem alle fragen. Im Landesinneren antwortet ${f.landSpot} mit Staub und PS auf Buggy- und Quadpisten. Dazwischen liegen Sonnenuntergangstörns und Jetski-Touren an der Uferpromenade von ${f.gateway} vorbei. Zum ersten Mal hier? Beginnen Sie mit einem Bootstag, einem Landtag und einem Sonnenuntergang.`,
    },
    {
      heading: 'Planen Sie Ihre Reise',
      body: `Bootstage nach ${f.signature} starten früh, meist vor ${f.departBy}, und sind vor dem Abendessen zurück; Sonnenuntergangstouren dauern 2,5 bis 3 Stunden, und die meisten Landtouren passen in einen Nachmittag. ${
        f.outsideHurricaneBelt
          ? `${n} liegt südlich des Hurrikangürtels, und der Passatwind hält die Hitze erträglich - Touren finden daher ganzjährig statt.`
          : `Auf ${n} finden Touren ganzjährig statt, am ruhigsten und trockensten von Dezember bis Mai.`
      } Dezember bis April ist Hochsaison, und die beliebten Boote sind zuerst ausgebucht: Buchen Sie diese einige Tage im Voraus, um die Feiertage herum noch früher. Sie kommen mit dem Kreuzfahrtschiff? Gleichen Sie den Treffpunkt einer Tour vor der Buchung mit Ihrem Terminal ab; viele Abfahrten liegen nur Minuten von ${f.quays} entfernt. Jeder angezeigte Preis enthält Steuern und Gebühren, und meist genügt eine Anzahlung, um Ihren Platz zu sichern.`,
    },
    {
      heading: 'Warum bei Island Tours buchen',
      body: `Island Tours wurde auf ${n} von Menschen aufgebaut, die hier aufgewachsen sind. Wir listen nicht alles: Wir wählen die Anbieter, zu denen wir unsere eigene Familie schicken würden, fahren die Touren selbst mit und schreiben jede Beschreibung aus eigener Erfahrung. Der angezeigte Preis ist der Gesamtpreis. Die meisten Touren reservieren Sie mit einer kleinen Anzahlung, Sie zahlen also nicht den ganzen Urlaub im Voraus, und jede Tour ist kostenlos stornierbar - keine Formulare, keine Rückfragen -, die genaue Frist steht auf jeder Tourseite. Und wenn Sie um 6:45 am Steg stehen und sich fragen, wo das Boot bleibt, antworten wir per WhatsApp von 08:00 bis 20:00 Uhr - von derselben Insel, wegen der Sie anrufen.`,
    },
  ],

  // ── Français ────────────────────────────────────────────────────────────────
  [Locale.fr]: (n, f) => [
    {
      heading: 'Meilleures choses à faire',
      body: `${f.signature}, c'est l'excursion dont on parle encore une fois rentré : une traversée de ${f.crossing[0]} à ${f.crossing[1]} minutes depuis ${f.gateway}, et un littoral qui dépasse toutes ses photos. Catamarans, bateaux à moteur et vedettes rapides y vont chaque jour. Plus près, ${f.calmSpot} est un territoire d'eau calme - criques abritées, spots de snorkeling et plages faciles à enchaîner - et ${f.nature} est le récif dont tout le monde parle. À l'intérieur des terres, ${f.landSpot} répond avec de la poussière et des chevaux sur les pistes de buggy et de quad. Entre les deux : voiliers au coucher du soleil et sorties en jet ski le long du front de mer de ${f.gateway}. Première visite ? Commencez par une journée en mer, une journée à terre et un coucher de soleil.`,
    },
    {
      heading: 'Planifier votre voyage',
      body: `Les journées en mer vers ${f.signature} partent tôt, généralement avant ${f.departBy}, et rentrent avant le dîner ; les croisières au coucher du soleil durent 2h30 à 3h, et la plupart des excursions à terre tiennent dans un après-midi. ${
        f.outsideHurricaneBelt
          ? `${n} se situe au sud de la ceinture cyclonique et l'alizé rend la chaleur supportable : les excursions ont donc lieu toute l'année.`
          : `À ${n}, les excursions ont lieu toute l'année, la période la plus calme et la plus sèche allant de décembre à mai.`
      } De décembre à avril, c'est la haute saison et les bateaux les plus demandés se remplissent en premier : réservez-les quelques jours à l'avance, davantage autour des fêtes. Vous arrivez en croisière ? Vérifiez le point de rendez-vous de l'excursion par rapport à votre terminal avant de réserver ; beaucoup de départs sont à quelques minutes de ${f.quays}. Chaque prix affiché inclut taxes et frais, et un acompte suffit généralement à retenir votre place.`,
    },
    {
      heading: 'Pourquoi réserver avec Island Tours',
      body: `Island Tours a été bâti à ${n} par des gens qui ont grandi ici. Nous ne référençons pas tout : nous choisissons les prestataires auxquels nous confierions notre propre famille, faisons les excursions nous-mêmes et rédigeons chaque description à partir de notre expérience. Le prix affiché est le prix complet. La plupart des excursions se réservent avec un petit acompte, vous ne payez donc pas tout le séjour d'avance, et chaque excursion est annulable gratuitement - sans formulaire ni justification -, le délai exact figurant sur chaque page. Et quand vous êtes sur le ponton à 6h45 à vous demander où est le bateau, nous répondons sur WhatsApp, de 08h00 à 20h00, depuis l'île même que vous appelez.`,
    },
  ],

  // ── Español ─────────────────────────────────────────────────────────────────
  [Locale.es]: (n, f) => [
    {
      heading: 'Las mejores cosas para hacer',
      body: `${f.signature} es la excursión de la que se sigue hablando al volver a casa: una travesía de ${f.crossing[0]} a ${f.crossing[1]} minutos desde ${f.gateway} y un litoral que supera cualquier foto. Catamaranes, lanchas y motoras hacen la ruta a diario. Más cerca, ${f.calmSpot} es territorio de aguas tranquilas - calas resguardadas, bahías para hacer esnórquel y playas fáciles de encadenar - y ${f.nature} es el arrecife por el que todos preguntan. Tierra adentro, ${f.landSpot} responde con polvo y caballos en rutas de buggy y quad. Entre medias quedan las salidas en velero al atardecer y las rutas en moto de agua junto al paseo marítimo de ${f.gateway}. ¿Primera visita? Empieza con un día de barco, un día de tierra y un atardecer.`,
    },
    {
      heading: 'Planificando tu viaje',
      body: `Los días de barco a ${f.signature} salen temprano, normalmente antes de las ${f.departBy}, y vuelven antes de cenar; los cruceros al atardecer duran de 2,5 a 3 horas y la mayoría de las excursiones terrestres caben en una tarde. ${
        f.outsideHurricaneBelt
          ? `${n} está al sur del cinturón de huracanes y el viento alisio hace llevadero el calor, así que hay excursiones todo el año.`
          : `En ${n} hay excursiones todo el año, y el tramo más tranquilo y seco va de diciembre a mayo.`
      } De diciembre a abril es temporada alta y los barcos más demandados se llenan primero: resérvalos con unos días de antelación, y con más margen en fiestas. ¿Llegas en crucero? Comprueba el punto de encuentro de la excursión frente a tu terminal antes de reservar; muchas salidas están a minutos de ${f.quays}. Cada precio que ves incluye impuestos y tasas, y normalmente basta un depósito para guardar tu plaza.`,
    },
    {
      heading: 'Por qué reservar con Island Tours',
      body: `Island Tours se ha construido en ${n} por gente que creció aquí. No publicamos todo: elegimos a los operadores a los que mandaríamos a nuestra propia familia, hacemos las excursiones nosotros mismos y escribimos cada descripción desde la experiencia. El precio que ves es el precio final. La mayoría de las excursiones se reservan con un pequeño depósito, así que no pagas todas las vacaciones por adelantado, y todas se pueden cancelar gratis - sin formularios ni preguntas -, con el plazo exacto en cada página. Y cuando estés en el muelle a las 6:45 preguntándote dónde está el barco, respondemos por WhatsApp, de 08:00 a 20:00, desde la misma isla por la que llamas.`,
    },
  ],

  // ── Português ───────────────────────────────────────────────────────────────
  [Locale.pt]: (n, f) => [
    {
      heading: 'Principais coisas para fazer',
      body: `${f.signature} é o passeio de que as pessoas ainda falam depois de voltar para casa: uma travessia de ${f.crossing[0]} a ${f.crossing[1]} minutos a partir de ${f.gateway} e uma costa que supera qualquer fotografia. Catamarãs, barcos a motor e lanchas fazem a viagem diariamente. Mais perto, ${f.calmSpot} é território de água calma - enseadas abrigadas, baías de snorkel e praias fáceis de encadear - e ${f.nature} é o recife por que todos perguntam. No interior, ${f.landSpot} responde com poeira e cavalos nos trilhos de buggy e quadriciclo. Pelo meio ficam os passeios à vela ao pôr do sol e as saídas de mota de água ao longo da marginal de ${f.gateway}. Primeira visita? Comece com um dia de barco, um dia em terra e um pôr do sol.`,
    },
    {
      heading: 'Planejando sua viagem',
      body: `Os dias de barco para ${f.signature} partem cedo, normalmente antes das ${f.departBy}, e regressam antes do jantar; os cruzeiros ao pôr do sol duram 2,5 a 3 horas e a maioria dos passeios terrestres cabe numa tarde. ${
        f.outsideHurricaneBelt
          ? `${n} fica a sul do cinturão de furacões e o vento alísio torna o calor suportável, por isso há passeios durante todo o ano.`
          : `Em ${n} há passeios durante todo o ano, sendo o período mais calmo e seco de dezembro a maio.`
      } De dezembro a abril é época alta e os barcos mais procurados enchem primeiro: reserve-os com alguns dias de antecedência, e com mais folga na época festiva. Chega de navio de cruzeiro? Confirme o ponto de encontro do passeio em relação ao seu terminal antes de reservar; muitas partidas ficam a minutos de ${f.quays}. Todos os preços que vê incluem impostos e taxas, e normalmente basta um depósito para garantir o seu lugar.`,
    },
    {
      heading: 'Por que reservar com a Island Tours',
      body: `A Island Tours foi construída em ${n} por pessoas que cresceram aqui. Não publicamos tudo: escolhemos os operadores a quem confiaríamos a nossa própria família, fazemos os passeios connosco mesmos e escrevemos cada descrição a partir da experiência. O preço que vê é o preço final. A maioria dos passeios reserva-se com um pequeno depósito, por isso não paga as férias todas adiantadas, e qualquer passeio pode ser cancelado gratuitamente - sem formulários nem perguntas -, com o prazo exato indicado em cada página. E quando estiver no cais às 6:45 a perguntar-se onde está o barco, respondemos no WhatsApp, das 08:00 às 20:00, a partir da mesma ilha por que está a ligar.`,
    },
  ],

  // ── 中文 ────────────────────────────────────────────────────────────────────
  [Locale.zh]: (n, f) => [
    {
      heading: '最热门的活动',
      body: `${f.signature}是那种回家后还会一直讲起的行程：从${f.gateway}出发，航程 ${f.crossing[0]} 至 ${f.crossing[1]} 分钟，海岸线比任何照片都更动人。双体帆船、机动艇和快艇每天都有班次。离岸更近的${f.calmSpot}则是风平浪静的水域，有浮潜湾、避风的小海湾和方便串联的海滩；${f.nature}是每个人都会问起的珊瑚礁。内陆的${f.landSpot}则以沙丘卡丁车和四轮摩托车路线，回应你对速度与尘土的想象。两者之间，还有日落帆船，以及沿${f.gateway}海滨的水上摩托车路线。第一次来？先安排一天出海、一天陆上行程，再加一场日落。`,
    },
    {
      heading: '规划您的行程',
      body: `前往${f.signature}的出海行程出发很早，通常在 ${f.departBy} 之前，晚餐前返回；日落巡航约 2.5 至 3 小时，多数陆上行程一个下午即可完成。${
        f.outsideHurricaneBelt
          ? `${n}位于飓风带以南，信风让暑气变得可以忍受，因此全年都有行程。`
          : `${n}全年都有行程，其中 12 月至次年 5 月最为平静干爽。`
      }12 月至次年 4 月是旺季，热门船班最先满员：请提前几天预订，节假日前后还需更早。乘邮轮抵达？预订前请先核对行程集合点与您的靠泊码头；许多出发点距离${f.quays}仅几分钟路程。您看到的每个价格均已包含税费，通常只需支付订金即可锁定名额。`,
    },
    {
      heading: '为什么选择 Island Tours 预订',
      body: `Island Tours 由在${n}长大的当地人一手打造。我们并非什么都上架：我们只挑选自己愿意让家人参加的供应商，亲自体验每条线路，并凭亲身经历撰写每一段介绍。您看到的价格就是全额价格。多数行程只需少量订金即可预订，无需提前支付整趟假期的费用；每个行程都可免费取消，无需填表、无需理由，具体截止时间标示在各行程页面。当您早上 6:45 站在码头、不确定船在哪里时，我们每天 08:00 至 20:00 通过 WhatsApp 为您解答，而接电话的人就在您所询问的这座岛上。`,
    },
  ],
};
