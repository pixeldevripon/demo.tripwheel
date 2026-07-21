// DEMO SEED — real-feeling localized content templates.
//
// Replaces the old `[NL] ...` machine-translation stubs with natural copy in
// every platform locale. Templates are parameterized by entity name so one
// hand-written translation set covers every destination/category/hub/tour
// without ballooning the seed. `isMachineTranslated` stays true on non-EN rows
// (the copy is seeded, not operator-reviewed).
//
// FAQ sets mirror the Figma designs and are INDEX-ALIGNED with their English
// counterparts (the shared faqGroupId links per-locale rows by position):
//   destFaqs (4)  <- destination page, Figma 47361:19834
//   catFaqs  (4)  <- category page,    Figma 47070:2456
//   hubFaqs  (9)  <- activity hub,     Figma 48024:12076
//   collFaqs (6)  <- collection page,  Figma 47433:2306

import { Locale } from '@prisma/client';

// ── Localized names for the 19 seeded global categories ─────────────────────────
type L6 = Record<Exclude<Locale, 'en'>, string>;

export const CATEGORY_NAME_I18N: Record<string, L6> = {
  'boat-tours': {
    nl: 'Boottochten & cruises',
    de: 'Bootstouren & Kreuzfahrten',
    fr: 'Excursions en bateau & croisières',
    es: 'Paseos en barco y cruceros',
    pt: 'Passeios de barco e cruzeiros',
    zh: '乘船游览与巡航',
  },
  snorkeling: {
    nl: 'Snorkeltochten',
    de: 'Schnorcheltouren',
    fr: 'Sorties snorkeling',
    es: 'Tours de esnórquel',
    pt: 'Passeios de snorkel',
    zh: '浮潜之旅',
  },
  'scuba-diving': {
    nl: 'Duiken',
    de: 'Gerätetauchen',
    fr: 'Plongée sous-marine',
    es: 'Buceo',
    pt: 'Mergulho',
    zh: '水肺潜水',
  },
  'sunset-cruises': {
    nl: 'Zonsondergangcruises',
    de: 'Sonnenuntergangstouren',
    fr: 'Croisières au coucher du soleil',
    es: 'Cruceros al atardecer',
    pt: 'Cruzeiros ao pôr do sol',
    zh: '日落巡航',
  },
  'sightseeing-tours': {
    nl: 'Sightseeingtours',
    de: 'Besichtigungstouren',
    fr: 'Visites touristiques',
    es: 'Tours turísticos',
    pt: 'Passeios turísticos',
    zh: '观光游览',
  },
  'day-trips': {
    nl: 'Dagtochten',
    de: 'Tagesausflüge',
    fr: 'Excursions à la journée',
    es: 'Excursiones de un día',
    pt: 'Passeios de um dia',
    zh: '一日游',
  },
  'off-road-tours': {
    nl: 'Offroadtours',
    de: 'Offroad-Touren',
    fr: 'Excursions tout-terrain',
    es: 'Tours todoterreno',
    pt: 'Passeios off-road',
    zh: '越野之旅',
  },
  'jet-ski': {
    nl: 'Jetski-tochten',
    de: 'Jetski-Touren',
    fr: 'Sorties en jet-ski',
    es: 'Tours en moto acuática',
    pt: 'Passeios de jet ski',
    zh: '摩托艇之旅',
  },
  parasailing: {
    nl: 'Parasailing',
    de: 'Parasailing',
    fr: 'Parachute ascensionnel',
    es: 'Parasailing',
    pt: 'Parasailing',
    zh: '滑翔伞拖曳',
  },
  'water-sports': {
    nl: 'Watersport',
    de: 'Wassersport',
    fr: 'Sports nautiques',
    es: 'Deportes acuáticos',
    pt: 'Esportes aquáticos',
    zh: '水上运动',
  },
  'fishing-trips': {
    nl: 'Vistochten',
    de: 'Angelausflüge',
    fr: 'Sorties de pêche',
    es: 'Salidas de pesca',
    pt: 'Pescarias',
    zh: '海钓之旅',
  },
  'nature-wildlife-tours': {
    nl: 'Natuur- en wildtochten',
    de: 'Natur- & Tierbeobachtung',
    fr: 'Nature & vie sauvage',
    es: 'Naturaleza y vida silvestre',
    pt: 'Natureza e vida selvagem',
    zh: '自然与野生动物之旅',
  },
  'hiking-tours': {
    nl: 'Wandeltochten',
    de: 'Wandertouren',
    fr: 'Randonnées guidées',
    es: 'Rutas de senderismo',
    pt: 'Trilhas e caminhadas',
    zh: '徒步之旅',
  },
  'adventure-tours': {
    nl: 'Avontuurlijke tochten',
    de: 'Abenteuertouren',
    fr: 'Aventures',
    es: 'Tours de aventura',
    pt: 'Passeios de aventura',
    zh: '探险之旅',
  },
  'cultural-tours': {
    nl: 'Cultuur & geschiedenis',
    de: 'Kultur- & Geschichtstouren',
    fr: 'Culture & histoire',
    es: 'Cultura e historia',
    pt: 'Cultura e história',
    zh: '文化历史之旅',
  },
  'food-tours': {
    nl: 'Eten & drinken',
    de: 'Kulinarische Touren',
    fr: 'Gastronomie & boissons',
    es: 'Gastronomía y bebidas',
    pt: 'Comida e bebida',
    zh: '美食美酒之旅',
  },
  'attraction-tickets': {
    nl: 'Tickets voor attracties',
    de: 'Attraktionstickets',
    fr: "Billets d'attractions",
    es: 'Entradas a atracciones',
    pt: 'Ingressos para atrações',
    zh: '景点门票',
  },
  'luxury-experiences': {
    nl: 'Luxe ervaringen',
    de: 'Luxus-Erlebnisse',
    fr: 'Expériences de luxe',
    es: 'Experiencias de lujo',
    pt: 'Experiências de luxo',
    zh: '奢华体验',
  },
  'workshops-classes': {
    nl: 'Workshops & cursussen',
    de: 'Workshops & Kurse',
    fr: 'Ateliers & cours',
    es: 'Talleres y clases',
    pt: 'Oficinas e aulas',
    zh: '工作坊与课程',
  },
};

/** Localized category name with EN fallback for unmapped slugs. */
export function categoryName(slug: string, locale: Locale, en: string): string {
  if (locale === Locale.en) return en;
  return CATEGORY_NAME_I18N[slug]?.[locale] ?? en;
}

// ── Destination About-band sections ─────────────────────────────────────────────
// The three blocks under the destination About copy. They are authored CMS rows
// (PageContentSection), not dictionary strings, precisely because the copy names
// real places on each island.
//
// The place names below are proper nouns, so they are identical in every locale -
// which is what lets ONE hand-written sentence set per locale produce genuinely
// island-specific copy for all five islands, the same trick CATEGORY_NAME_I18N
// plays for category labels.

export type IslandFacts = {
  /** The island's signature boat trip / landmark you sail out to. */
  signature: string;
  /** A second well-known nature or snorkel spot. */
  nature: string;
  /** Main town or harbour front where the day ends. */
  gateway: string;
  /** Roughly how long the crossing to `signature` takes, one way, in minutes. */
  crossingMinutes: number;
};

/** Keyed by destination slug (see the destination list in prisma/seed.ts). */
export const ISLAND_FACTS: Record<string, IslandFacts> = {
  curacao: {
    signature: 'Klein Curaçao',
    nature: 'Playa Piskado',
    gateway: 'Willemstad',
    crossingMinutes: 90,
  },
  aruba: {
    signature: 'the Antilla wreck',
    nature: 'Arikok National Park',
    gateway: 'Oranjestad',
    crossingMinutes: 30,
  },
  'sint-maarten': {
    signature: 'Tintamarre',
    nature: 'Mullet Bay',
    gateway: 'Philipsburg',
    crossingMinutes: 45,
  },
  'saint-lucia': {
    signature: 'the Pitons',
    nature: 'Sulphur Springs',
    gateway: 'Castries',
    crossingMinutes: 60,
  },
  bahamas: {
    signature: 'the Exuma Cays',
    nature: 'Blue Lagoon',
    gateway: 'Nassau',
    crossingMinutes: 75,
  },
};

/**
 * Identity of the three sections, shared by every locale. `destSections` returns
 * heading + body INDEX-ALIGNED with this array (same convention as the FAQ sets),
 * so the seed can pair them up without threading keys through each translation.
 *
 * `anchor` targets sections that already exist further down the destination page -
 * these blocks are in-page navigation as well as copy, so the targets must keep
 * matching the ids the page renders.
 *
 * `dictKey` names the bundled `destination.about.*` label each block replaces. The
 * frontend falls back to it when an island has no authored rows yet.
 */
export const DEST_SECTIONS = [
  { key: 'top-things', anchor: 'experiences', dictKey: 'topThings' },
  { key: 'planning', anchor: 'planning', dictKey: 'planning' },
  { key: 'why-book', anchor: 'faq', dictKey: 'whyBook' },
] as const;

// ── Per-locale prose templates ──────────────────────────────────────────────────
type Faq = { q: string; a: string };
type Section = { heading: string; body: string };

export interface LocaleTemplates {
  destOverview: (name: string) => string;
  destAbout: (name: string) => string;
  destMetaTitle: (name: string) => string;
  catOverview: (localName: string) => string;
  catAbout: (localName: string) => string;
  catH1: (localName: string) => string;
  catMetaTitle: (localName: string) => string;
  hubTagline: string;
  hubLead: (name: string) => string;
  hubAbout: (name: string) => string;
  hubMetaTitle: (name: string) => string;
  /** Card/detail overview for a tour in this locale (title stays English). */
  tourOverview: (title: string, destName: string) => string;
  /** 4 destination FAQs (Figma 47361:19834), parameterized by island name. */
  destFaqs: (name: string) => Faq[];
  /** 4 category FAQs (Figma 47070:2456), parameterized by localized label. */
  catFaqs: (label: string) => Faq[];
  /** 9 hub FAQs (Figma 48024:12076), parameterized by hub name. */
  hubFaqs: (name: string) => Faq[];
  /** 6 collection FAQs (Figma 47433:2306), parameterized by destination name. */
  collFaqs: (destName: string) => Faq[];
  /** 3 About-band sections, INDEX-ALIGNED with DEST_SECTIONS. */
  destSections: (name: string, f: IslandFacts) => Section[];
}

/** English base for the three About-band sections. */
export const DEST_SECTIONS_EN = (name: string, f: IslandFacts): Section[] => [
  {
    heading: 'Top things to do',
    body: `Sail out to ${f.signature}, make time for ${f.nature}, then finish the day on the ${f.gateway} waterfront. The crossing runs about ${f.crossingMinutes} minutes each way, so most boats are back well before sunset.`,
  },
  {
    heading: 'Planning your trip',
    body: `Boats fill up fastest between December and April, and the water is calmest first thing in the morning. Book two or three days ahead in high season, and pick a departure before 10:00 if anyone in your group gets seasick.`,
  },
  {
    heading: 'Why book with Island Tours',
    body: `We live on ${name} and know every operator here by name, so nothing gets listed that we would not send our own friends on. You hold your place with a small deposit rather than the full amount, and the price on the page is the price you pay.`,
  },
];

export const TEMPLATES: Record<Exclude<Locale, 'en'>, LocaleTemplates> = {
  // ── Nederlands ──────────────────────────────────────────────────────────────
  nl: {
    destOverview: (n) =>
      `${n} combineert turquoise water en poederzachte stranden met een cultuur die je nergens anders vindt. Van rifsnorkelen tot zeiltochten bij zonsondergang: deze tours zijn gekozen door locals die elk baaitje kennen.`,
    destAbout: (n) =>
      `${n} is een van de meest veelzijdige eilanden van de Caraïben. Duik langs kleurrijke riffen, vaar naar verborgen stranden en proef de mengelmoes van culturen. Elke ervaring wordt uitgevoerd door een gescreende lokale aanbieder, met gratis annulering en directe bevestiging.`,
    destMetaTitle: (n) => `${n} tours & activiteiten | Island Tours`,
    catOverview: (c) =>
      `Ontdek de beste ${c.toLowerCase()} op de eilanden: stuk voor stuk gecontroleerd, direct te boeken en met gratis annulering.`,
    catAbout: (c) =>
      `Op zoek naar ${c.toLowerCase()}? Vergelijk het aanbod op prijs, duur en beoordeling en boek de tour die bij je reis past. Elke aanbieder is door ons team gescreend.`,
    catH1: (c) => `De beste ${c.toLowerCase()}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: 'Waar eilandbewoners hun bezoekers naartoe sturen',
    hubLead: (n) =>
      `${n} is het dagtripje waar locals elke bezoeker naartoe sturen: hagelwit zand, kalm turquoise water en snorkelen boven scheepswrakken en zeeschildpadden. Boten raken weken van tevoren volgeboekt, dus reserveer op tijd.`,
    hubAbout: (n) =>
      `${n} is een hoogtepunt van elke reis naar het eiland. Alleen per boot bereikbaar, en het vroege opstaan meer dan waard: hier vind je het helderste water van de Caraïben.`,
    hubMetaTitle: (n) => `${n} dagtochten | Island Tours`,
    tourOverview: (t, d) =>
      `${t} is een van de best beoordeelde ervaringen op ${d}. Directe bevestiging, gratis annulering en een gescreende lokale aanbieder: boek online en je plek staat vast.`,
    destFaqs: (n) => [
      {
        q: 'Kan ik annuleren als mijn plannen veranderen?',
        a: 'De meeste tours zijn tot 24 uur voor vertrek gratis te annuleren, met volledige terugbetaling. Geen formulieren, geen vragen: annuleer direct vanuit je bevestigingsmail.',
      },
      {
        q: 'Moet ik nu het hele bedrag betalen?',
        a: "Nee. Bij de meeste tours betaal je vandaag slechts zo'n 20% om je plek vast te leggen; de rest volgt dichter bij je reis. De exacte verdeling zie je op elke tourpagina voordat je boekt.",
      },
      {
        q: 'Wie zit er achter Island Tours?',
        a: `Wij zijn locals. We zijn op deze eilanden opgegroeid, kennen elke aanbieder op ${n} persoonlijk en plaatsen alleen tours waar we onze eigen vrienden en familie naartoe zouden sturen.`,
      },
      {
        q: 'Wat gebeurt er als mijn tour wordt geannuleerd?',
        a: 'Moet een aanbieder annuleren - meestal door weer of veiligheid - dan kies je tussen volledige terugbetaling of gratis omboeken naar het eerstvolgende vertrek. We sturen je meteen bericht zodra er iets verandert.',
      },
    ],
    catFaqs: (c) => [
      {
        q: `Wat is inbegrepen bij een typische tour uit ${c.toLowerCase()}?`,
        a: "Alles wat je voor de activiteit nodig hebt, een lokale gids of bemanning en de vermelde extra's. Elke tourpagina toont exact wat is inbegrepen.",
      },
      {
        q: `Hoe kies ik de juiste optie binnen ${c.toLowerCase()}?`,
        a: 'Vergelijk op prijs, duur en beoordelingen. Elke tourpagina laat precies zien wat je krijgt, zodat je snel de beste match voor je gezelschap vindt.',
      },
      {
        q: `Zijn ${c.toLowerCase()} geschikt voor kinderen?`,
        a: "Veel wel: check de leeftijdsgrenzen op de tourpagina. Tours met het label 'geschikt voor gezinnen' zijn de veiligste keuze voor jonge kinderen.",
      },
      {
        q: 'Heb ik ervaring of speciale vaardigheden nodig?',
        a: 'Voor de meeste tours niet. Waar wel eisen gelden (zwemmen, rijbewijs, minimumleeftijd) staan die duidelijk op de tourpagina.',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `Is ${n} de moeite waard?`,
        a: `Ja. ${n} is het dagtripje dat eilandbewoners als eerste aanraden: ongerept zand, kalm turquoise water en snorkelen direct vanaf het strand. Het is een volle dag, en bijna niemand heeft er spijt van.`,
      },
      {
        q: `Wat is er te doen op ${n}?`,
        a: 'Zwemmen en snorkelen boven het rif, de kust verkennen en neerstrijken op een rustig stuk strand. Bij de meeste tours zijn lunch en strandfaciliteiten inbegrepen.',
      },
      {
        q: `Wat kost een trip naar ${n}?`,
        a: 'Dagtochten beginnen doorgaans rond de $100-130 per persoon, inclusief overtocht, snorkelspullen en lunch. Privécharters worden per boot geprijsd; de exacte prijzen staan op elke tourpagina.',
      },
      {
        q: `Hoe lang duurt de boottocht naar ${n}?`,
        a: 'Reken op circa 45 minuten tot 1,5 uur per enkele reis, afhankelijk van de boot. Tochten vertrekken vroeg om te profiteren van het kalme ochtendwater.',
      },
      {
        q: `Word ik zeeziek onderweg naar ${n}?`,
        a: 'Het open stuk kan levendig zijn. Ga achterin zitten, houd je blik op de horizon en neem eventueel een uur van tevoren een reistablet; de terugtocht is meestal rustiger.',
      },
      {
        q: `Wat moet ik meenemen naar ${n}?`,
        a: 'Rifvriendelijke zonnebrand, waterschoenen, een pet en een handdoek. Schaduw is schaars, dus bescherming tegen de zon is belangrijk. Snorkelspullen en lunch zijn bij de meeste tours inbegrepen.',
      },
      {
        q: `Zijn er toiletten op ${n}?`,
        a: 'Aan boord van elke boot wel, en aanbieders met een strandhuis hebben basisvoorzieningen aan land. Verder is het eiland onbebouwd.',
      },
      {
        q: `Is ${n} geschikt voor gezinnen met jonge kinderen?`,
        a: 'Ja. Kies een stabiele familieboot of catamaran voor de rustigste overtocht; de zwemplekken zijn ondiep, kalm en ideaal voor kinderen.',
      },
      {
        q: `Wat als het weer slecht is op de dag van mijn trip naar ${n}?`,
        a: 'Kapiteins houden de omstandigheden dagelijks in de gaten en annuleren of verzetten als de overtocht niet veilig is. Jij kiest dan tussen het eerstvolgende vertrek of volledige terugbetaling.',
      },
    ],
    collFaqs: (d) => [
      {
        q: `Wat zijn de leukste dingen om te doen op ${d}?`,
        a: `De ervaringen in deze lijst zijn de klassiekers van ${d}: een mix van avontuur op het water en verkenning aan land, met de hand gekozen door ons lokale team.`,
      },
      {
        q: 'Hoe ver van tevoren moet ik deze tours boeken?',
        a: 'In het hoogseizoen raken populaire vertrektijden weken van tevoren vol. Boeken is direct bevestigd en gratis annuleerbaar, dus vroeg vastleggen kent geen risico.',
      },
      {
        q: `Wat is de beste reistijd voor ${d}?`,
        a: `${d} is het hele jaar door goed te bezoeken. Januari tot en met augustus is het droogst en zonnigst; september tot december is het water warmer en is het rustiger.`,
      },
      {
        q: 'Is hotelovername bij deze tours inbegrepen?',
        a: 'Sommige tours halen je op bij je hotel of bieden dat als extra aan; bij de andere staat het ontmoetingspunt duidelijk op de tourpagina met kaart en inchecktijd.',
      },
      {
        q: 'Kan ik meerdere tours combineren in één reis?',
        a: 'Zeker: de meeste tours duren een halve of hele dag, dus twee of drie ervaringen in een week is heel gebruikelijk. Plan een rustdag tussen lange bootdagen.',
      },
      {
        q: 'Hoe bepaalt Island Tours welke tours hier staan?',
        a: 'Ons lokale team selecteert op ervaring, beoordelingen en eigen indrukken ter plaatse. Een plek in deze lijst is niet te koop: een tour verdient hem.',
      },
    ],
    destSections: (n, f) => [
      {
        heading: 'Top dingen om te doen',
        body: `Vaar naar ${f.signature}, neem de tijd voor ${f.nature} en sluit de dag af aan de boulevard van ${f.gateway}. De overtocht duurt ongeveer ${f.crossingMinutes} minuten enkele reis, dus de meeste boten zijn ruim voor zonsondergang terug.`,
      },
      {
        heading: 'Plan je reis',
        body: "Tussen december en april zitten de boten het snelst vol en is het water 's ochtends vroeg het rustigst. Boek in het hoogseizoen twee tot drie dagen van tevoren en kies een vertrek voor 10:00 als iemand in je gezelschap snel zeeziek wordt.",
      },
      {
        heading: 'Waarom boeken bij Island Tours',
        body: `We wonen op ${n} en kennen elke aanbieder hier persoonlijk; we plaatsen niets waar we onze eigen vrienden niet naartoe zouden sturen. Je legt je plek vast met een kleine aanbetaling in plaats van het hele bedrag, en de prijs op de pagina is de prijs die je betaalt.`,
      },
    ],
  },

  // ── Deutsch ─────────────────────────────────────────────────────────────────
  de: {
    destOverview: (n) =>
      `${n} verbindet türkisblaues Wasser und puderweiche Strände mit einer Kultur, die es so nur hier gibt. Vom Riffschnorcheln bis zum Segeltörn bei Sonnenuntergang: Diese Touren haben Einheimische ausgewählt, die jede Bucht kennen.`,
    destAbout: (n) =>
      `${n} gehört zu den lohnendsten Inseln der Karibik. Tauchen Sie an bunten Riffen, segeln Sie zu versteckten Stränden und probieren Sie die vielfältige Inselküche. Jedes Erlebnis wird von einem geprüften lokalen Anbieter durchgeführt - mit kostenloser Stornierung und sofortiger Bestätigung.`,
    destMetaTitle: (n) => `${n} Touren & Aktivitäten | Island Tours`,
    catOverview: (c) =>
      `Entdecken Sie die besten ${c} der Inseln: geprüft, sofort buchbar und mit kostenloser Stornierung.`,
    catAbout: (c) =>
      `Auf der Suche nach ${c}? Vergleichen Sie Preis, Dauer und Bewertungen und buchen Sie die Tour, die zu Ihrer Reise passt. Jeder Anbieter ist von unserem Team geprüft.`,
    catH1: (c) => `Die besten ${c}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: 'Wohin Einheimische ihre Gäste schicken',
    hubLead: (n) =>
      `${n} ist der Tagesausflug, den Einheimische jedem Besucher empfehlen: strahlend weißer Sand, ruhiges türkisfarbenes Wasser und Schnorcheln über Schiffswracks und Schildkrötengründen. Die Boote sind Wochen im Voraus ausgebucht - früh reservieren.`,
    hubAbout: (n) =>
      `${n} ist ein Höhepunkt jeder Inselreise. Nur per Boot erreichbar - und das frühe Aufstehen wert: Hier wartet das klarste Wasser der Karibik.`,
    hubMetaTitle: (n) => `${n} Tagesausflüge | Island Tours`,
    tourOverview: (t, d) =>
      `${t} zählt zu den bestbewerteten Erlebnissen auf ${d}. Sofortige Bestätigung, kostenlose Stornierung und ein geprüfter lokaler Anbieter - online buchen und der Platz ist sicher.`,
    destFaqs: (n) => [
      {
        q: 'Kann ich stornieren, wenn sich meine Pläne ändern?',
        a: 'Die meisten Touren lassen sich bis 24 Stunden vor Beginn kostenlos stornieren - mit voller Rückerstattung. Keine Formulare, keine Rückfragen: Stornieren Sie direkt aus Ihrer Bestätigungs-E-Mail.',
      },
      {
        q: 'Muss ich jetzt den vollen Preis bezahlen?',
        a: 'Nein. Bei den meisten Touren zahlen Sie heute nur rund 20% an, der Rest folgt näher am Reisetermin. Die genaue Aufteilung sehen Sie vor der Buchung auf jeder Tourseite.',
      },
      {
        q: 'Wer steht hinter Island Tours?',
        a: `Wir sind Einheimische. Wir sind auf diesen Inseln aufgewachsen, kennen jeden Anbieter auf ${n} persönlich und listen nur Touren, auf die wir auch unsere eigenen Freunde und Familie schicken würden.`,
      },
      {
        q: 'Was passiert, wenn meine Tour abgesagt wird?',
        a: 'Muss ein Anbieter absagen - meist wegen Wetter oder Sicherheit - wählen Sie zwischen voller Rückerstattung und kostenloser Umbuchung auf die nächste verfügbare Abfahrt. Wir informieren Sie sofort, sobald sich etwas ändert.',
      },
    ],
    catFaqs: (c) => [
      {
        q: `Was ist bei einer typischen Tour aus der Kategorie ${c} enthalten?`,
        a: 'Alles, was Sie für die Aktivität brauchen, ein lokaler Guide oder eine Crew sowie die angegebenen Extras. Jede Tourseite listet die genauen Leistungen auf.',
      },
      {
        q: `Wie wähle ich die richtige Option in der Kategorie ${c}?`,
        a: 'Vergleichen Sie Preis, Dauer und Bewertungen. Jede Tourseite zeigt genau, was enthalten ist - so finden Sie schnell die beste Wahl für Ihre Gruppe.',
      },
      {
        q: `Sind ${c} für Kinder geeignet?`,
        a: "Viele ja - prüfen Sie die Altersangaben auf der Tourseite. Touren mit dem Label 'familienfreundlich' sind für kleine Kinder die sicherste Wahl.",
      },
      {
        q: 'Brauche ich Erfahrung oder besondere Fähigkeiten?',
        a: 'Für die meisten Touren nicht. Wo Anforderungen gelten (Schwimmen, Führerschein, Mindestalter), stehen sie klar auf der Tourseite.',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `Lohnt sich ${n}?`,
        a: `Ja. ${n} ist der Tagesausflug, den Einheimische zuerst empfehlen: unberührter Sand, ruhiges türkisfarbenes Wasser und Schnorcheln direkt vom Strand. Es ist ein voller Tag - und kaum jemand bereut ihn.`,
      },
      {
        q: `Was kann man auf ${n} unternehmen?`,
        a: 'Schwimmen und über dem Riff schnorcheln, die Küste erkunden und sich ein ruhiges Stück Strand sichern. Bei den meisten Touren sind Mittagessen und Strandausstattung inklusive.',
      },
      {
        q: `Was kostet ein Ausflug nach ${n}?`,
        a: 'Ganztagestouren starten meist bei etwa 100-130 $ pro Person - inklusive Überfahrt, Ausrüstung und Mittagessen. Private Charter werden pro Boot berechnet; die genauen Preise stehen auf jeder Tourseite.',
      },
      {
        q: `Wie lange dauert die Bootsfahrt nach ${n}?`,
        a: 'Je nach Boot etwa 45 Minuten bis 1,5 Stunden pro Strecke. Die Touren starten früh, um das ruhige Morgenwasser zu nutzen.',
      },
      {
        q: `Werde ich auf der Fahrt nach ${n} seekrank?`,
        a: 'Der offene Abschnitt kann bewegt sein. Setzen Sie sich nach hinten, halten Sie den Blick auf den Horizont und nehmen Sie bei Anfälligkeit eine Stunde vorher eine Reisetablette - die Rückfahrt ist meist ruhiger.',
      },
      {
        q: `Was sollte ich nach ${n} mitnehmen?`,
        a: 'Riff-freundliche Sonnencreme, Wasserschuhe, eine Kappe und ein Handtuch. Schatten ist knapp, Sonnenschutz daher wichtig. Schnorchelausrüstung und Mittagessen sind meist inklusive.',
      },
      {
        q: `Gibt es Toiletten auf ${n}?`,
        a: 'An Bord jedes Bootes ja - und Anbieter mit Strandhaus haben einfache Einrichtungen an Land. Darüber hinaus ist die Insel unbebaut.',
      },
      {
        q: `Ist ${n} für Familien mit kleinen Kindern geeignet?`,
        a: 'Ja - wählen Sie ein ruhigeres Familienboot oder einen Katamaran für die sanfteste Überfahrt. Die Badebereiche sind flach, ruhig und kinderfreundlich.',
      },
      {
        q: `Was passiert bei schlechtem Wetter an meinem ${n}-Ausflugstag?`,
        a: 'Die Kapitäne beobachten die Bedingungen täglich und sagen ab oder verschieben, wenn die Überfahrt nicht sicher ist. Sie wählen dann zwischen der nächsten Abfahrt und voller Rückerstattung.',
      },
    ],
    collFaqs: (d) => [
      {
        q: `Was sind die besten Aktivitäten auf ${d}?`,
        a: `Die Erlebnisse in dieser Liste sind die Klassiker von ${d}: eine Mischung aus Abenteuern auf dem Wasser und Erkundungen an Land, handverlesen von unserem lokalen Team.`,
      },
      {
        q: 'Wie weit im Voraus sollte ich diese Touren buchen?',
        a: 'In der Hochsaison sind beliebte Abfahrten Wochen vorher ausgebucht. Die Buchung wird sofort bestätigt und ist kostenlos stornierbar - früh buchen hat also keine Nachteile.',
      },
      {
        q: `Wann ist die beste Reisezeit für ${d}?`,
        a: `${d} ist ganzjährig ein gutes Ziel. Januar bis August ist am trockensten und sonnigsten; von September bis Dezember ist das Wasser wärmer und die Insel ruhiger.`,
      },
      {
        q: 'Ist bei diesen Touren der Hoteltransfer inbegriffen?',
        a: 'Manche Touren holen Sie am Hotel ab oder bieten das als Extra an; bei den übrigen ist der Treffpunkt mit Karte und Check-in-Zeit klar auf der Tourseite angegeben.',
      },
      {
        q: 'Kann ich mehrere Touren in einer Reise kombinieren?',
        a: 'Auf jeden Fall - die meisten Touren dauern einen halben oder ganzen Tag, zwei bis drei Erlebnisse pro Woche sind üblich. Planen Sie zwischen langen Bootstagen einen Ruhetag ein.',
      },
      {
        q: 'Wie entscheidet Island Tours, welche Touren hier erscheinen?',
        a: 'Unser lokales Team wählt nach Erfahrung, Bewertungen und eigenen Eindrücken vor Ort aus. Ein Platz auf dieser Liste ist nicht käuflich - eine Tour muss ihn sich verdienen.',
      },
    ],
    destSections: (n, f) => [
      {
        heading: 'Top-Aktivitäten',
        body: `Segeln Sie hinaus nach ${f.signature}, nehmen Sie sich Zeit für ${f.nature} und lassen Sie den Tag an der Uferpromenade von ${f.gateway} ausklingen. Die Überfahrt dauert etwa ${f.crossingMinutes} Minuten pro Strecke, sodass die meisten Boote lange vor Sonnenuntergang zurück sind.`,
      },
      {
        heading: 'Planen Sie Ihre Reise',
        body: 'Zwischen Dezember und April sind die Boote am schnellsten ausgebucht, und am ruhigsten ist das Wasser früh am Morgen. Buchen Sie in der Hochsaison zwei bis drei Tage im Voraus und wählen Sie eine Abfahrt vor 10:00 Uhr, wenn jemand in Ihrer Gruppe schnell seekrank wird.',
      },
      {
        heading: 'Warum bei Island Tours buchen',
        body: `Wir leben auf ${n} und kennen hier jeden Anbieter persönlich - wir listen nichts, wohin wir nicht auch unsere eigenen Freunde schicken würden. Sie sichern sich Ihren Platz mit einer kleinen Anzahlung statt des vollen Betrags, und der Preis auf der Seite ist der Preis, den Sie zahlen.`,
      },
    ],
  },

  // ── Français ────────────────────────────────────────────────────────────────
  fr: {
    destOverview: (n) =>
      `${n} associe une eau turquoise et des plages de sable poudreux à une culture unique. Du snorkeling sur les récifs aux voiliers au coucher du soleil, ces excursions sont choisies par des locaux qui connaissent chaque crique.`,
    destAbout: (n) =>
      `${n} est l'une des îles les plus gratifiantes des Caraïbes. Plongez sur des récifs colorés, naviguez vers des plages cachées et goûtez au mélange de cultures de l'île. Chaque expérience est assurée par un opérateur local vérifié, avec annulation gratuite et confirmation immédiate.`,
    destMetaTitle: (n) => `${n} : excursions & activités | Island Tours`,
    catOverview: (c) =>
      `Découvrez les meilleures offres de ${c.toLowerCase()} des îles : vérifiées, réservables immédiatement et avec annulation gratuite.`,
    catAbout: (c) =>
      `Vous cherchez ${c.toLowerCase()} ? Comparez les prix, la durée et les avis, puis réservez l'excursion qui correspond à votre voyage. Chaque opérateur est vérifié par notre équipe.`,
    catH1: (c) => `Le meilleur de : ${c.toLowerCase()}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: 'Là où les habitants envoient leurs visiteurs',
    hubLead: (n) =>
      `${n}, c'est l'excursion d'une journée que les habitants recommandent à chaque visiteur : sable immaculé, eaux turquoise calmes et snorkeling au-dessus d'épaves et de tortues. Les bateaux affichent complet des semaines à l'avance : réservez tôt.`,
    hubAbout: (n) =>
      `${n} est un temps fort de tout séjour sur l'île. Accessible uniquement en bateau, le départ matinal en vaut la peine : l'eau y est parmi les plus claires des Caraïbes.`,
    hubMetaTitle: (n) => `${n} : excursions à la journée | Island Tours`,
    tourOverview: (t, d) =>
      `${t} fait partie des expériences les mieux notées à ${d}. Confirmation immédiate, annulation gratuite et opérateur local vérifié : réservez en ligne, votre place est garantie.`,
    destFaqs: (n) => [
      {
        q: 'Puis-je annuler si mes plans changent ?',
        a: "La plupart des excursions sont annulables jusqu'à 24 h avant le départ, avec remboursement intégral. Pas de formulaire, pas de questions : annulez directement depuis votre e-mail de confirmation.",
      },
      {
        q: 'Dois-je payer la totalité maintenant ?',
        a: "Non. Sur la plupart des excursions, vous ne versez qu'environ 20 % aujourd'hui pour bloquer votre place, et le reste plus près du départ. La répartition exacte est affichée sur chaque page avant de réserver.",
      },
      {
        q: 'Qui se cache derrière Island Tours ?',
        a: `Nous sommes des locaux. Nous avons grandi sur ces îles, nous connaissons personnellement chaque opérateur de ${n} et nous ne listons que des excursions où nous enverrions nos propres amis et notre famille.`,
      },
      {
        q: 'Que se passe-t-il si mon excursion est annulée ?',
        a: 'Si un opérateur doit annuler - le plus souvent pour la météo ou la sécurité - vous choisissez entre un remboursement intégral et une nouvelle réservation gratuite sur le prochain départ. Nous vous prévenons dès que quelque chose change.',
      },
    ],
    catFaqs: (c) => [
      {
        q: `Que comprend une excursion type en ${c.toLowerCase()} ?`,
        a: "Tout le nécessaire pour l'activité, un guide ou un équipage local et les extras indiqués. Chaque page d'excursion détaille précisément ce qui est inclus.",
      },
      {
        q: `Comment choisir la bonne option en ${c.toLowerCase()} ?`,
        a: 'Comparez le prix, la durée et les avis. Chaque page montre exactement ce qui est compris, pour trouver rapidement la meilleure option pour votre groupe.',
      },
      {
        q: `Les ${c.toLowerCase()} conviennent-elles aux enfants ?`,
        a: "Beaucoup, oui : vérifiez les limites d'âge sur la page de l'excursion. Le label « adapté aux familles » est la valeur la plus sûre pour les plus jeunes.",
      },
      {
        q: "Faut-il de l'expérience ou des compétences particulières ?",
        a: 'Pour la plupart des excursions, non. Les exigences éventuelles (natation, permis, âge minimum) sont clairement indiquées sur la page.',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `${n}, ça vaut le coup ?`,
        a: `Oui. ${n} est l'excursion que les habitants recommandent en premier : sable intact, eau turquoise calme et snorkeling directement depuis la plage. C'est une journée complète, et presque personne ne la regrette.`,
      },
      {
        q: `Que faire sur ${n} ?`,
        a: "Nager, faire du snorkeling au-dessus du récif, longer la côte et s'installer sur un coin de plage tranquille. La plupart des excursions incluent le déjeuner et les équipements de plage.",
      },
      {
        q: `Combien coûte une excursion à ${n} ?`,
        a: 'Les journées complètes démarrent autour de 100-130 $ par personne, traversée, équipement et déjeuner compris. Les charters privés sont facturés au bateau ; les prix exacts figurent sur chaque page.',
      },
      {
        q: `Combien de temps dure la traversée vers ${n} ?`,
        a: "Comptez entre 45 minutes et 1 h 30 par trajet selon le bateau. Les départs sont matinaux pour profiter d'une mer calme.",
      },
      {
        q: `Vais-je avoir le mal de mer en allant à ${n} ?`,
        a: "La partie en pleine mer peut être remuante. Installez-vous à l'arrière, gardez les yeux sur l'horizon et prenez un comprimé une heure avant si vous y êtes sujet - le retour est en général plus doux.",
      },
      {
        q: `Que faut-il apporter à ${n} ?`,
        a: "De la crème solaire sans danger pour les récifs, des chaussures d'eau, une casquette et une serviette. L'ombre est rare, la protection solaire compte. Équipement de snorkeling et déjeuner sont inclus sur la plupart des excursions.",
      },
      {
        q: `Y a-t-il des toilettes sur ${n} ?`,
        a: "Oui, à bord de chaque bateau - et les opérateurs disposant d'une installation de plage ont des sanitaires basiques à terre. Au-delà, l'île est vierge.",
      },
      {
        q: `${n} convient-elle aux familles avec de jeunes enfants ?`,
        a: 'Oui - choisissez un bateau familial ou un catamaran, plus stables, pour la traversée la plus douce. Les zones de baignade sont peu profondes et calmes.',
      },
      {
        q: `Que se passe-t-il en cas de mauvais temps le jour de mon excursion à ${n} ?`,
        a: "Les capitaines surveillent les conditions chaque jour et annulent ou reportent si la traversée n'est pas sûre. Vous choisissez alors entre le prochain départ disponible et un remboursement intégral.",
      },
    ],
    collFaqs: (d) => [
      {
        q: `Quelles sont les meilleures choses à faire à ${d} ?`,
        a: `Les expériences de cette liste sont les grands classiques de ${d} : un mélange d'aventures en mer et d'explorations à terre, sélectionnées à la main par notre équipe locale.`,
      },
      {
        q: "Combien de temps à l'avance réserver ces excursions ?",
        a: "En haute saison, les départs populaires affichent complet des semaines à l'avance. La réservation est confirmée immédiatement et annulable gratuitement : réserver tôt ne présente aucun risque.",
      },
      {
        q: `Quelle est la meilleure période pour visiter ${d} ?`,
        a: `${d} se visite toute l'année. De janvier à août, c'est la période la plus sèche et ensoleillée ; de septembre à décembre, l'eau est plus chaude et l'île plus calme.`,
      },
      {
        q: "Ces excursions incluent-elles la prise en charge à l'hôtel ?",
        a: "Certaines l'incluent ou la proposent en option ; pour les autres, le point de rendez-vous est clairement indiqué sur la page avec une carte et l'heure d'enregistrement.",
      },
      {
        q: 'Puis-je combiner plusieurs excursions dans un même voyage ?',
        a: 'Bien sûr : la plupart durent une demi-journée ou une journée, donc deux ou trois expériences par semaine sont tout à fait courantes. Prévoyez une journée de repos entre deux longues sorties en mer.',
      },
      {
        q: 'Comment Island Tours choisit-il les excursions mises en avant ?',
        a: "Notre équipe locale sélectionne selon l'expérience, les avis et ses propres impressions sur place. Une place dans cette liste ne s'achète pas : elle se mérite.",
      },
    ],
    destSections: (n, f) => [
      {
        heading: 'Meilleures choses à faire',
        body: `Naviguez jusqu'à ${f.signature}, prenez le temps de découvrir ${f.nature}, puis terminez la journée sur le front de mer de ${f.gateway}. La traversée dure environ ${f.crossingMinutes} minutes par trajet : la plupart des bateaux sont rentrés bien avant le coucher du soleil.`,
      },
      {
        heading: 'Planifier votre voyage',
        body: "Les bateaux se remplissent le plus vite entre décembre et avril, et la mer est la plus calme en tout début de matinée. En haute saison, réservez deux à trois jours à l'avance et choisissez un départ avant 10h00 si quelqu'un de votre groupe a le mal de mer.",
      },
      {
        heading: 'Pourquoi réserver avec Island Tours',
        body: `Nous vivons à ${n} et connaissons personnellement chaque prestataire d'ici : nous ne référençons rien où nous n'enverrions pas nos propres amis. Vous réservez votre place avec un petit acompte plutôt que la totalité, et le prix affiché est le prix que vous payez.`,
      },
    ],
  },

  // ── Español ─────────────────────────────────────────────────────────────────
  es: {
    destOverview: (n) =>
      `${n} combina aguas turquesas y playas de arena fina con una cultura única. Del esnórquel en arrecifes a los veleros al atardecer, estos tours los eligen locales que conocen cada cala.`,
    destAbout: (n) =>
      `${n} es una de las islas más gratificantes del Caribe. Bucea en arrecifes llenos de color, navega hacia playas escondidas y prueba la mezcla de culturas de la isla. Cada experiencia la opera un proveedor local verificado, con cancelación gratuita y confirmación al instante.`,
    destMetaTitle: (n) => `Tours y actividades en ${n} | Island Tours`,
    catOverview: (c) =>
      `Descubre lo mejor en ${c.toLowerCase()} de las islas: opciones verificadas, reserva inmediata y cancelación gratuita.`,
    catAbout: (c) =>
      `¿Buscas ${c.toLowerCase()}? Compara precio, duración y valoraciones y reserva el tour que mejor encaje con tu viaje. Cada operador está verificado por nuestro equipo.`,
    catH1: (c) => `Lo mejor en ${c.toLowerCase()}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: 'Adonde los isleños mandan a sus visitantes',
    hubLead: (n) =>
      `${n} es la excursión de un día que los locales recomiendan a todo visitante: arena blanquísima, aguas turquesas tranquilas y esnórquel sobre naufragios y zonas de tortugas. Los barcos se agotan con semanas de antelación: reserva pronto.`,
    hubAbout: (n) =>
      `${n} es uno de los momentos estrella de cualquier viaje a la isla. Solo se llega en barco, y madrugar merece la pena: aquí está el agua más clara del Caribe.`,
    hubMetaTitle: (n) => `Excursiones de un día a ${n} | Island Tours`,
    tourOverview: (t, d) =>
      `${t} está entre las experiencias mejor valoradas de ${d}. Confirmación inmediata, cancelación gratuita y un operador local verificado: reserva online y tu plaza queda garantizada.`,
    destFaqs: (n) => [
      {
        q: '¿Puedo cancelar si cambian mis planes?',
        a: 'La mayoría de los tours se pueden cancelar hasta 24 h antes del inicio con reembolso completo. Sin formularios ni preguntas: cancela directamente desde tu correo de confirmación.',
      },
      {
        q: '¿Tengo que pagar todo ahora?',
        a: 'No. En la mayoría de los tours hoy pagas solo un 20% para asegurar tu plaza y el resto más cerca del viaje. El desglose exacto aparece en cada página antes de reservar.',
      },
      {
        q: '¿Quién está detrás de Island Tours?',
        a: `Somos locales. Crecimos en estas islas, conocemos personalmente a cada operador de ${n} y solo publicamos tours a los que mandaríamos a nuestros propios amigos y familia.`,
      },
      {
        q: '¿Qué pasa si cancelan mi tour?',
        a: 'Si un operador tiene que cancelar - normalmente por clima o seguridad - eliges entre reembolso completo o cambio gratuito a la siguiente salida disponible. Te avisamos en cuanto algo cambia.',
      },
    ],
    catFaqs: (c) => [
      {
        q: `¿Qué incluye un tour típico de ${c.toLowerCase()}?`,
        a: 'Todo lo necesario para la actividad, un guía o tripulación local y los extras indicados. Cada página del tour detalla exactamente qué incluye.',
      },
      {
        q: `¿Cómo elijo la opción adecuada de ${c.toLowerCase()}?`,
        a: 'Compara precio, duración y valoraciones. Cada página muestra exactamente qué está incluido, así encuentras rápido la mejor opción para tu grupo.',
      },
      {
        q: `¿Los ${c.toLowerCase()} son aptos para niños?`,
        a: "Muchos sí: revisa los límites de edad en la página del tour. Los tours con la etiqueta 'apto para familias' son la opción más segura para los pequeños.",
      },
      {
        q: '¿Necesito experiencia o habilidades especiales?',
        a: 'Para la mayoría de los tours, no. Cuando hay requisitos (nadar, licencia, edad mínima) aparecen claros en la página del tour.',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `¿Merece la pena ${n}?`,
        a: `Sí. ${n} es la excursión que los isleños recomiendan primero: arena intacta, aguas turquesas tranquilas y esnórquel directamente desde la playa. Es un día completo, y casi nadie se arrepiente.`,
      },
      {
        q: `¿Qué se puede hacer en ${n}?`,
        a: 'Nadar y hacer esnórquel sobre el arrecife, recorrer la costa e instalarte en un tramo tranquilo de playa. La mayoría de los tours incluyen almuerzo e instalaciones de playa.',
      },
      {
        q: `¿Cuánto cuesta una excursión a ${n}?`,
        a: 'Los días completos parten de unos 100-130 $ por persona, con travesía, equipo y almuerzo incluidos. Los chárteres privados se cobran por barco; los precios exactos están en cada página.',
      },
      {
        q: `¿Cuánto dura el trayecto en barco a ${n}?`,
        a: 'Entre 45 minutos y 1,5 horas por trayecto según el barco. Las salidas son temprano para aprovechar el mar en calma de la mañana.',
      },
      {
        q: `¿Me marearé de camino a ${n}?`,
        a: 'El tramo de mar abierto puede moverse. Siéntate atrás, mantén la vista en el horizonte y toma una pastilla una hora antes si eres propenso: la vuelta suele ser más suave.',
      },
      {
        q: `¿Qué debo llevar a ${n}?`,
        a: 'Protector solar respetuoso con el arrecife, escarpines, gorra y toalla. La sombra escasea, así que la protección solar importa. El equipo de esnórquel y el almuerzo van incluidos en la mayoría de los tours.',
      },
      {
        q: `¿Hay baños en ${n}?`,
        a: 'Sí, a bordo de todos los barcos, y los operadores con casa de playa tienen instalaciones básicas en tierra. Más allá de eso, la isla está sin urbanizar.',
      },
      {
        q: `¿Es ${n} adecuada para familias con niños pequeños?`,
        a: 'Sí: elige un barco familiar o un catamarán, más estables, para la travesía más suave. Las zonas de baño son poco profundas y tranquilas.',
      },
      {
        q: `¿Qué pasa si hace mal tiempo el día de mi excursión a ${n}?`,
        a: 'Los capitanes vigilan las condiciones a diario y cancelan o reprograman si la travesía no es segura. Entonces eliges entre la siguiente salida disponible o el reembolso completo.',
      },
    ],
    collFaqs: (d) => [
      {
        q: `¿Cuáles son las mejores cosas que hacer en ${d}?`,
        a: `Las experiencias de esta lista son los clásicos de ${d}: una mezcla de aventuras en el mar y exploración en tierra, elegidas a mano por nuestro equipo local.`,
      },
      {
        q: '¿Con cuánta antelación debo reservar estos tours?',
        a: 'En temporada alta las salidas populares se agotan con semanas de antelación. La reserva se confirma al instante y se cancela gratis, así que adelantarse no tiene riesgo.',
      },
      {
        q: `¿Cuándo es la mejor época para visitar ${d}?`,
        a: `${d} se puede visitar todo el año. De enero a agosto es la época más seca y soleada; de septiembre a diciembre el agua está más cálida y hay menos gente.`,
      },
      {
        q: '¿Estos tours incluyen recogida en el hotel?',
        a: 'Algunos la incluyen o la ofrecen como extra; en los demás, el punto de encuentro aparece claro en la página con mapa y hora de presentación.',
      },
      {
        q: '¿Puedo combinar varios tours en un mismo viaje?',
        a: 'Claro: la mayoría duran medio día o un día completo, así que dos o tres experiencias por semana es lo habitual. Deja un día de descanso entre jornadas largas de barco.',
      },
      {
        q: '¿Cómo decide Island Tours qué tours destacar?',
        a: 'Nuestro equipo local selecciona por experiencia, valoraciones y sus propias impresiones sobre el terreno. Un puesto en esta lista no se compra: se gana.',
      },
    ],
    destSections: (n, f) => [
      {
        heading: 'Las mejores cosas para hacer',
        body: `Navega hasta ${f.signature}, dedica tiempo a ${f.nature} y termina el día en el paseo marítimo de ${f.gateway}. La travesía dura unos ${f.crossingMinutes} minutos por trayecto, así que la mayoría de los barcos vuelven mucho antes del atardecer.`,
      },
      {
        heading: 'Planificando tu viaje',
        body: 'Los barcos se llenan más rápido entre diciembre y abril, y el mar está más tranquilo a primera hora de la mañana. En temporada alta reserva con dos o tres días de antelación y elige una salida antes de las 10:00 si alguien de tu grupo se marea.',
      },
      {
        heading: 'Por qué reservar con Island Tours',
        body: `Vivimos en ${n} y conocemos por su nombre a cada operador de aquí: no publicamos nada a lo que no enviaríamos a nuestros propios amigos. Reservas tu plaza con un pequeño depósito en lugar del importe completo, y el precio de la página es el precio que pagas.`,
      },
    ],
  },

  // ── Português ───────────────────────────────────────────────────────────────
  pt: {
    destOverview: (n) =>
      `${n} combina águas azul-turquesa e praias de areia fininha com uma cultura única. Do snorkel nos recifes aos veleiros ao pôr do sol, estes passeios são escolhidos por locais que conhecem cada enseada.`,
    destAbout: (n) =>
      `${n} é uma das ilhas mais recompensadoras do Caribe. Mergulhe em recifes coloridos, navegue até praias escondidas e prove a mistura de culturas da ilha. Cada experiência é operada por um fornecedor local verificado, com cancelamento grátis e confirmação imediata.`,
    destMetaTitle: (n) => `Passeios e atividades em ${n} | Island Tours`,
    catOverview: (c) =>
      `Descubra o melhor em ${c.toLowerCase()} das ilhas: opções verificadas, reserva imediata e cancelamento grátis.`,
    catAbout: (c) =>
      `Procurando ${c.toLowerCase()}? Compare preço, duração e avaliações e reserve o passeio ideal para a sua viagem. Todos os operadores são verificados pela nossa equipe.`,
    catH1: (c) => `O melhor em ${c.toLowerCase()}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: 'Para onde os moradores mandam seus visitantes',
    hubLead: (n) =>
      `${n} é o passeio de um dia que os moradores recomendam a todo visitante: areia branquíssima, águas calmas azul-turquesa e snorkel sobre naufrágios e áreas de tartarugas. Os barcos esgotam com semanas de antecedência: reserve cedo.`,
    hubAbout: (n) =>
      `${n} é um dos pontos altos de qualquer viagem à ilha. Só se chega de barco, e acordar cedo vale a pena: aqui está a água mais cristalina do Caribe.`,
    hubMetaTitle: (n) => `Passeios de um dia a ${n} | Island Tours`,
    tourOverview: (t, d) =>
      `${t} está entre as experiências mais bem avaliadas de ${d}. Confirmação imediata, cancelamento grátis e um operador local verificado: reserve online e sua vaga está garantida.`,
    destFaqs: (n) => [
      {
        q: 'Posso cancelar se meus planos mudarem?',
        a: 'A maioria dos passeios pode ser cancelada até 24 h antes do início, com reembolso total. Sem formulários, sem perguntas: cancele direto do seu e-mail de confirmação.',
      },
      {
        q: 'Preciso pagar tudo agora?',
        a: 'Não. Na maioria dos passeios você paga hoje apenas cerca de 20% para garantir a vaga e o restante mais perto da viagem. A divisão exata aparece em cada página antes de reservar.',
      },
      {
        q: 'Quem está por trás do Island Tours?',
        a: `Somos moradores locais. Crescemos nestas ilhas, conhecemos pessoalmente cada operador de ${n} e só listamos passeios para os quais mandaríamos nossos próprios amigos e família.`,
      },
      {
        q: 'E se o meu passeio for cancelado?',
        a: 'Se um operador precisar cancelar - normalmente por clima ou segurança - você escolhe entre reembolso total ou remarcação gratuita para a próxima saída disponível. Avisamos assim que algo mudar.',
      },
    ],
    catFaqs: (c) => [
      {
        q: `O que está incluído em um passeio típico de ${c.toLowerCase()}?`,
        a: 'Tudo o que você precisa para a atividade, um guia ou tripulação local e os extras indicados. Cada página de passeio detalha exatamente o que está incluído.',
      },
      {
        q: `Como escolho a opção certa de ${c.toLowerCase()}?`,
        a: 'Compare preço, duração e avaliações. Cada página mostra exatamente o que está incluído, facilitando achar a melhor opção para o seu grupo.',
      },
      {
        q: `Os ${c.toLowerCase()} são adequados para crianças?`,
        a: "Muitos sim: confira os limites de idade na página do passeio. Os passeios com selo 'ideal para famílias' são a escolha mais segura para os pequenos.",
      },
      {
        q: 'Preciso de experiência ou habilidades especiais?',
        a: 'Para a maioria dos passeios, não. Quando há requisitos (nadar, habilitação, idade mínima), eles aparecem claramente na página.',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `${n} vale a pena?`,
        a: `Sim. ${n} é o passeio que os moradores recomendam primeiro: areia intocada, águas calmas azul-turquesa e snorkel direto da praia. É um dia inteiro - e quase ninguém se arrepende.`,
      },
      {
        q: `O que fazer em ${n}?`,
        a: 'Nadar e fazer snorkel sobre o recife, caminhar pela costa e se acomodar num trecho tranquilo de praia. A maioria dos passeios inclui almoço e estrutura de praia.',
      },
      {
        q: `Quanto custa um passeio a ${n}?`,
        a: 'Os passeios de dia inteiro partem de cerca de US$ 100-130 por pessoa, incluindo travessia, equipamento e almoço. Charters privados são cobrados por barco; os preços exatos estão em cada página.',
      },
      {
        q: `Quanto tempo dura a travessia de barco até ${n}?`,
        a: 'Entre 45 minutos e 1,5 hora por trecho, dependendo do barco. As saídas são cedo para aproveitar o mar calmo da manhã.',
      },
      {
        q: `Vou enjoar no caminho para ${n}?`,
        a: 'O trecho de mar aberto pode balançar. Sente-se atrás, mantenha o olhar no horizonte e tome um comprimido uma hora antes se for propenso - a volta costuma ser mais tranquila.',
      },
      {
        q: `O que devo levar para ${n}?`,
        a: 'Protetor solar que não agrida os recifes, sapatilhas aquáticas, boné e toalha. Sombra é rara, então proteção solar importa. Equipamento de snorkel e almoço estão incluídos na maioria dos passeios.',
      },
      {
        q: `Há banheiros em ${n}?`,
        a: 'Sim, a bordo de todos os barcos - e os operadores com casa de praia têm instalações básicas em terra. Fora isso, a ilha é intocada.',
      },
      {
        q: `${n} é adequada para famílias com crianças pequenas?`,
        a: 'Sim - escolha um barco familiar ou catamarã, mais estáveis, para a travessia mais suave. As áreas de banho são rasas e calmas.',
      },
      {
        q: `O que acontece se o tempo estiver ruim no dia do meu passeio a ${n}?`,
        a: 'Os capitães monitoram as condições diariamente e cancelam ou remarcam se a travessia não for segura. Você então escolhe entre a próxima saída disponível ou o reembolso total.',
      },
    ],
    collFaqs: (d) => [
      {
        q: `Quais são as melhores coisas para fazer em ${d}?`,
        a: `As experiências desta lista são os clássicos de ${d}: uma mistura de aventuras no mar e exploração em terra, escolhidas a dedo pela nossa equipe local.`,
      },
      {
        q: 'Com quanta antecedência devo reservar estes passeios?',
        a: 'Na alta temporada, as saídas populares esgotam com semanas de antecedência. A reserva é confirmada na hora e cancelável de graça: antecipar não tem risco.',
      },
      {
        q: `Qual é a melhor época para visitar ${d}?`,
        a: `${d} recebe bem o ano todo. De janeiro a agosto é a época mais seca e ensolarada; de setembro a dezembro a água está mais quente e a ilha mais tranquila.`,
      },
      {
        q: 'Estes passeios incluem busca no hotel?',
        a: 'Alguns incluem ou oferecem como extra; nos demais, o ponto de encontro aparece claro na página com mapa e horário de check-in.',
      },
      {
        q: 'Posso combinar vários passeios na mesma viagem?',
        a: 'Claro: a maioria dura meio dia ou um dia inteiro, então duas ou três experiências por semana é o normal. Deixe um dia de descanso entre dias longos de barco.',
      },
      {
        q: 'Como o Island Tours escolhe quais passeios destacar?',
        a: 'Nossa equipe local seleciona por experiência, avaliações e impressões próprias no local. Um lugar nesta lista não se compra: se conquista.',
      },
    ],
    destSections: (n, f) => [
      {
        heading: 'Principais coisas para fazer',
        body: `Navegue até ${f.signature}, reserve tempo para ${f.nature} e termine o dia na marginal de ${f.gateway}. A travessia demora cerca de ${f.crossingMinutes} minutos em cada sentido, por isso a maioria dos barcos regressa muito antes do pôr do sol.`,
      },
      {
        heading: 'Planejando sua viagem',
        body: 'Os barcos enchem mais depressa entre dezembro e abril, e o mar está mais calmo logo de manhã cedo. Na época alta, reserve com dois ou três dias de antecedência e escolha uma partida antes das 10:00 se alguém do seu grupo enjoar facilmente.',
      },
      {
        heading: 'Por que reservar com a Island Tours',
        body: `Vivemos em ${n} e conhecemos cada operador daqui pelo nome - não publicamos nada para onde não mandaríamos os nossos próprios amigos. Garante o seu lugar com um pequeno depósito em vez do valor total, e o preço da página é o preço que paga.`,
      },
    ],
  },

  // ── 简体中文 ─────────────────────────────────────────────────────────────────
  zh: {
    destOverview: (n) =>
      `${n}拥有碧绿的海水、细软的沙滩和独一无二的岛屿文化。从珊瑚礁浮潜到日落帆船巡航，这些行程都由熟悉每一处海湾的本地人精心挑选。`,
    destAbout: (n) =>
      `${n}是加勒比地区最值得探索的海岛之一。潜入五彩珊瑚礁、乘船前往隐秘海滩、品尝多元文化交融的美食。每一项体验都由经过审核的本地运营商提供，支持免费取消、即时确认。`,
    destMetaTitle: (n) => `${n}旅游项目与活动 | Island Tours`,
    catOverview: (c) =>
      `探索海岛上最优质的${c}：全部经过审核，可即时预订，并支持免费取消。`,
    catAbout: (c) =>
      `在寻找${c}吗？按价格、时长和评分对比后，预订最适合您行程的项目。所有运营商均经过我们团队审核。`,
    catH1: (c) => `精选${c}`,
    catMetaTitle: (c) => `${c} | Island Tours`,
    hubTagline: '本地人最推荐的去处',
    hubLead: (n) =>
      `${n}是本地人推荐给每位游客的一日游目的地：洁白的沙滩、平静的碧绿海水，还能在沉船和海龟栖息地上方浮潜。船票通常提前数周售罄，请尽早预订。`,
    hubAbout: (n) =>
      `${n}是海岛之行的高光时刻。只能乘船抵达，早起绝对值得：这里有加勒比最清澈的海水。`,
    hubMetaTitle: (n) => `${n}一日游 | Island Tours`,
    tourOverview: (t, d) =>
      `${t}是${d}评分最高的体验之一。即时确认、免费取消、本地运营商经过审核：在线预订即可锁定名额。`,
    destFaqs: (n) => [
      {
        q: '行程有变可以取消吗？',
        a: '大多数行程可在出发前 24 小时内免费取消并全额退款。无需填表、无需说明理由，直接从确认邮件里取消即可。',
      },
      {
        q: '现在需要付全款吗？',
        a: '不需要。大多数行程今天只需支付约 20% 的定金即可锁定名额，余款临近出行再付。具体比例在预订前的行程页面上写得很清楚。',
      },
      {
        q: 'Island Tours 是什么团队？',
        a: `我们是本地人，在这些海岛上长大，认识${n}的每一家运营商，只上架我们愿意推荐给自己亲友的行程。`,
      },
      {
        q: '如果行程被取消怎么办？',
        a: '若运营商因天气或安全原因取消，您可以选择全额退款或免费改期到下一个可用班次。一旦有变动我们会第一时间通知您。',
      },
    ],
    catFaqs: (c) => [
      {
        q: `一次典型的${c}都包含什么？`,
        a: '活动所需的全部装备、本地向导或船员，以及页面列明的附加项目。每个行程页面都会写清具体包含内容。',
      },
      {
        q: `如何在${c}中挑选合适的行程？`,
        a: '对比价格、时长和评分。每个行程页面都清楚列出包含内容，很快就能为同行伙伴找到最合适的选择。',
      },
      {
        q: `${c}适合儿童参加吗？`,
        a: '许多都适合：请查看行程页面的年龄限制。带有"适合家庭"标签的行程对幼儿来说最稳妥。',
      },
      {
        q: '需要经验或特殊技能吗？',
        a: '大多数行程不需要。如有要求（游泳、驾照、最低年龄），都会在行程页面上明确标注。',
      },
    ],
    hubFaqs: (n) => [
      {
        q: `${n}值得去吗？`,
        a: `值得。${n}是本地人首推的一日游：未经开发的沙滩、平静的碧绿海水，下水就能浮潜。虽然是完整的一天行程，但几乎没有人后悔。`,
      },
      {
        q: `在${n}能做什么？`,
        a: '在珊瑚礁上方游泳浮潜、沿海岸漫步，或找一片安静的沙滩躺下。大多数行程包含午餐和沙滩设施。',
      },
      {
        q: `去${n}的行程要花多少钱？`,
        a: '全天行程通常每人 100-130 美元起，包含船程、装备和午餐。私人包船按整船计价，具体价格见各行程页面。',
      },
      {
        q: `到${n}的船程要多久？`,
        a: '视船型而定，单程约 45 分钟至 1.5 小时。行程通常清早出发，以利用平静的晨间海面。',
      },
      {
        q: `去${n}的路上会晕船吗？`,
        a: '外海航段可能颠簸。请坐在船尾、注视地平线；容易晕船的话可提前一小时服用晕船药，返程通常平稳许多。',
      },
      {
        q: `去${n}要带什么？`,
        a: '珊瑚友好型防晒霜、溯溪鞋、帽子和毛巾。岛上遮荫很少，防晒很重要。浮潜装备和午餐大多包含在行程里。',
      },
      {
        q: `${n}上有洗手间吗？`,
        a: '每艘船上都有；设有海滩小屋的运营商在岸上也有基础设施。除此之外，岛上没有其他建筑。',
      },
      {
        q: `${n}适合带小孩的家庭吗？`,
        a: '适合。选择更平稳的家庭船或双体船，航程最舒适；游泳区水浅浪静，非常适合儿童。',
      },
      {
        q: `如果出行当天${n}天气不好怎么办？`,
        a: '船长每天监测海况，若航行不安全会取消或改期。届时您可选择下一个可用班次或全额退款。',
      },
    ],
    collFaqs: (d) => [
      {
        q: `${d}最值得做的事情有哪些？`,
        a: `这份榜单上的体验正是${d}的招牌：海上冒险与陆地探索兼备，由我们的本地团队亲手挑选。`,
      },
      {
        q: '这些行程需要提前多久预订？',
        a: '旺季热门班次会提前数周订满。预订即时确认且可免费取消，提前锁定没有任何风险。',
      },
      {
        q: `什么时候去${d}最合适？`,
        a: `${d}全年皆宜。1 月至 8 月最干燥、阳光最充足；9 月至 12 月海水更温暖，游客也更少。`,
      },
      {
        q: '这些行程包含酒店接送吗？',
        a: '部分行程包含接送或可加购；其余行程的集合地点都在页面上配有地图和签到时间，标注清晰。',
      },
      {
        q: '一次旅行可以安排多个行程吗？',
        a: '当然可以：大多数行程为半天或一天，一周安排两三项体验很常见。建议在长时间出海的日子之间留出一天休息。',
      },
      {
        q: 'Island Tours 如何决定推荐哪些行程？',
        a: '我们的本地团队根据体验质量、真实评价和实地考察来甄选。榜单位置无法购买，只能靠品质赢得。',
      },
    ],
    destSections: (n, f) => [
      {
        heading: '最热门的活动',
        body: `乘船前往${f.signature}，留出时间游览${f.nature}，最后在${f.gateway}的海滨漫步结束这一天。单程航行约 ${f.crossingMinutes} 分钟，因此大多数船只都会在日落前很久返回。`,
      },
      {
        heading: '规划您的行程',
        body: '12 月至次年 4 月的船位最紧张，而清晨的海面最为平静。旺季请提前两到三天预订；如果同行有人容易晕船，建议选择上午 10:00 之前出发的班次。',
      },
      {
        heading: '为什么选择 Island Tours 预订',
        body: `我们就住在${n}，与这里的每一位供应商都相熟；不会送自己朋友去的行程，我们也不会上架。您只需支付少量订金即可锁定名额，无需全额付款，页面上标示的价格就是您实际支付的价格。`,
      },
    ],
  },
};

/** Templates for a locale (undefined for en - the caller renders base English). */
export function tpl(locale: Locale): LocaleTemplates | null {
  if (locale === Locale.en) return null;
  return TEMPLATES[locale];
}
