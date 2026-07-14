// DEMO SEED — real-feeling localized content templates.
//
// Replaces the old `[NL] ...` machine-translation stubs with natural copy in
// every platform locale. Templates are parameterized by entity name so one
// hand-written translation set covers every destination/category/hub/tour
// without ballooning the seed. `isMachineTranslated` stays true on non-EN rows
// (the copy is seeded, not operator-reviewed).

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

// ── Per-locale prose templates ──────────────────────────────────────────────────
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
  /** 6 destination FAQs, parameterized by island name. */
  destFaqs: (name: string) => { q: string; a: string }[];
  /** 6 category FAQs, parameterized by the localized category label. */
  catFaqs: (label: string) => { q: string; a: string }[];
}

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
        q: `Wat is de beste reistijd voor ${n}?`,
        a: `${n} is het hele jaar door een goede keuze. De droogste, zonnigste maanden lopen van januari tot en met augustus; van september tot december is het water op zijn warmst en is het rustiger.`,
      },
      {
        q: `Moet ik tours op ${n} vooraf boeken?`,
        a: `Populaire tours zijn in het hoogseizoen snel volgeboekt. Online reserveren is gratis annuleerbaar en direct bevestigd, dus vroeg boeken heeft geen nadelen.`,
      },
      {
        q: `Kan ik annuleren als mijn plannen veranderen?`,
        a: `Ja. Elke tour heeft gratis annulering tot het tijdstip dat op de tourpagina staat, zonder vragen.`,
      },
      {
        q: `Hoe verplaats ik me op ${n}?`,
        a: `Een huurauto geeft de meeste vrijheid, maar veel tours bieden hotelovername aan. Taxi's zijn er volop; spreek de prijs vooraf af.`,
      },
      {
        q: `Kan ik overal met dollars of kaart betalen?`,
        a: `Vrijwel overal worden Amerikaanse dollars en creditcards geaccepteerd. Kleine strandtentjes werken soms alleen met contant geld.`,
      },
      {
        q: `Is ${n} geschikt voor gezinnen met kinderen?`,
        a: `Zeker. Kalme baaien, familieboten en korte vaartijden maken het eiland heel kindvriendelijk. Filter op 'geschikt voor gezinnen' om de beste opties te zien.`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `Hoe kies ik de juiste tour binnen ${c.toLowerCase()}?`,
        a: `Vergelijk op prijs, duur en beoordeling. Elke tourpagina laat precies zien wat er is inbegrepen, zodat je makkelijk de beste match voor je groep vindt.`,
      },
      {
        q: `Moet ik vooraf reserveren?`,
        a: `In het hoogseizoen wel: populaire vertrektijden zijn snel vol. Boeken is direct bevestigd, dus je hoeft nergens op te wachten.`,
      },
      {
        q: `Kan ik gratis annuleren?`,
        a: `Ja, tot het annuleringsvenster dat op de tourpagina staat. Daarna gelden de voorwaarden van de aanbieder.`,
      },
      {
        q: `Wat moet ik meenemen?`,
        a: `Zonnebrand (rifvriendelijk), een handdoek, zwemkleding en een beetje contant geld voor fooien. Per tour staat aangegeven wat er verder nodig is.`,
      },
      {
        q: `Zijn deze tours geschikt voor kinderen?`,
        a: `Veel wel: let op de leeftijdsgrenzen op de tourpagina. Tours met het label 'geschikt voor gezinnen' zijn de veiligste keuze.`,
      },
      {
        q: `Zit vervoer erbij inbegrepen?`,
        a: `Bij sommige tours is hotelovername inbegrepen of bij te boeken; anders staat het ontmoetingspunt duidelijk op de tourpagina met kaart.`,
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
        q: `Wann ist die beste Reisezeit für ${n}?`,
        a: `${n} ist ein Ganzjahresziel. Die trockensten, sonnigsten Monate sind Januar bis August; von September bis Dezember ist das Wasser am wärmsten und die Insel ruhiger.`,
      },
      {
        q: `Sollte ich Touren auf ${n} im Voraus buchen?`,
        a: `In der Hochsaison sind beliebte Touren schnell ausgebucht. Die Online-Buchung ist sofort bestätigt und kostenlos stornierbar - früh buchen hat also keine Nachteile.`,
      },
      {
        q: `Kann ich stornieren, wenn sich meine Pläne ändern?`,
        a: `Ja. Jede Tour lässt sich bis zu dem auf der Tourseite angegebenen Zeitpunkt kostenlos stornieren - ohne Rückfragen.`,
      },
      {
        q: `Wie komme ich auf ${n} von A nach B?`,
        a: `Ein Mietwagen bietet die größte Freiheit, viele Touren beinhalten aber einen Hoteltransfer. Taxis sind überall verfügbar - den Preis vorher vereinbaren.`,
      },
      {
        q: `Kann ich mit Dollar oder Karte bezahlen?`,
        a: `US-Dollar und Kreditkarten werden fast überall akzeptiert. Kleine Strandbars nehmen manchmal nur Bargeld.`,
      },
      {
        q: `Ist ${n} für Familien mit Kindern geeignet?`,
        a: `Absolut. Ruhige Buchten, Familienboote und kurze Überfahrten machen die Insel sehr kinderfreundlich. Filtern Sie nach 'familienfreundlich' für die besten Optionen.`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `Wie finde ich die richtige Tour in der Kategorie ${c}?`,
        a: `Vergleichen Sie Preis, Dauer und Bewertungen. Jede Tourseite zeigt genau, was enthalten ist - so finden Sie schnell die beste Wahl für Ihre Gruppe.`,
      },
      {
        q: `Muss ich im Voraus reservieren?`,
        a: `In der Hochsaison ja: Beliebte Abfahrten sind schnell voll. Die Buchung wird sofort bestätigt, es gibt keine Wartezeit.`,
      },
      {
        q: `Kann ich kostenlos stornieren?`,
        a: `Ja, bis zu dem auf der Tourseite angegebenen Storno-Fenster. Danach gelten die Bedingungen des Anbieters.`,
      },
      {
        q: `Was sollte ich mitbringen?`,
        a: `Riff-freundliche Sonnencreme, ein Handtuch, Badesachen und etwas Bargeld für Trinkgeld. Alles Weitere steht auf der jeweiligen Tourseite.`,
      },
      {
        q: `Sind die Touren für Kinder geeignet?`,
        a: `Viele ja - achten Sie auf die Altersangaben auf der Tourseite. Touren mit dem Label 'familienfreundlich' sind die sicherste Wahl.`,
      },
      {
        q: `Ist der Transfer inbegriffen?`,
        a: `Bei manchen Touren ist der Hoteltransfer enthalten oder zubuchbar; ansonsten ist der Treffpunkt mit Karte klar auf der Tourseite angegeben.`,
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
        q: `Quelle est la meilleure période pour visiter ${n} ?`,
        a: `${n} se visite toute l'année. Les mois les plus secs et ensoleillés vont de janvier à août ; de septembre à décembre, l'eau est plus chaude et l'île plus calme.`,
      },
      {
        q: `Faut-il réserver les excursions à ${n} à l'avance ?`,
        a: `En haute saison, les excursions populaires affichent vite complet. La réservation en ligne est confirmée immédiatement et annulable gratuitement : réserver tôt ne présente aucun risque.`,
      },
      {
        q: `Puis-je annuler si mes plans changent ?`,
        a: `Oui. Chaque excursion est annulable gratuitement jusqu'au délai indiqué sur sa page, sans justification.`,
      },
      {
        q: `Comment se déplacer à ${n} ?`,
        a: `La voiture de location offre le plus de liberté, mais beaucoup d'excursions proposent la prise en charge à l'hôtel. Les taxis sont nombreux : convenez du prix avant de partir.`,
      },
      {
        q: `Peut-on payer en dollars ou par carte ?`,
        a: `Les dollars américains et les cartes bancaires sont acceptés presque partout. Les petites paillotes de plage ne prennent parfois que les espèces.`,
      },
      {
        q: `${n} convient-elle aux familles avec enfants ?`,
        a: `Tout à fait. Baies calmes, bateaux familiaux et traversées courtes en font une île très adaptée aux enfants. Filtrez sur « adapté aux familles » pour voir les meilleures options.`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `Comment choisir la bonne excursion en ${c.toLowerCase()} ?`,
        a: `Comparez le prix, la durée et les avis. Chaque page d'excursion détaille précisément ce qui est inclus, pour trouver facilement la meilleure option pour votre groupe.`,
      },
      {
        q: `Faut-il réserver à l'avance ?`,
        a: `En haute saison, oui : les départs populaires se remplissent vite. La réservation est confirmée immédiatement, sans attente.`,
      },
      {
        q: `L'annulation est-elle gratuite ?`,
        a: `Oui, jusqu'au délai d'annulation indiqué sur la page de l'excursion. Au-delà, les conditions de l'opérateur s'appliquent.`,
      },
      {
        q: `Que faut-il apporter ?`,
        a: `De la crème solaire sans danger pour les récifs, une serviette, un maillot et un peu d'espèces pour les pourboires. Le reste est précisé sur chaque page.`,
      },
      {
        q: `Ces excursions conviennent-elles aux enfants ?`,
        a: `Beaucoup, oui : vérifiez les limites d'âge sur la page de l'excursion. Le label « adapté aux familles » est la valeur la plus sûre.`,
      },
      {
        q: `Le transport est-il inclus ?`,
        a: `Certaines excursions incluent (ou proposent en option) la prise en charge à l'hôtel ; sinon, le point de rendez-vous est clairement indiqué avec une carte.`,
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
        q: `¿Cuál es la mejor época para visitar ${n}?`,
        a: `${n} es un destino para todo el año. Los meses más secos y soleados van de enero a agosto; de septiembre a diciembre el agua está más cálida y hay menos gente.`,
      },
      {
        q: `¿Conviene reservar los tours en ${n} con antelación?`,
        a: `En temporada alta los tours populares se agotan rápido. Reservar online tiene confirmación inmediata y cancelación gratuita, así que adelantarse no tiene riesgo.`,
      },
      {
        q: `¿Puedo cancelar si cambian mis planes?`,
        a: `Sí. Todos los tours tienen cancelación gratuita hasta el plazo indicado en su página, sin preguntas.`,
      },
      {
        q: `¿Cómo me muevo por ${n}?`,
        a: `Un coche de alquiler da la mayor libertad, pero muchos tours incluyen recogida en el hotel. Hay taxis por todas partes: acuerda el precio antes de subir.`,
      },
      {
        q: `¿Se puede pagar con dólares o tarjeta?`,
        a: `Los dólares estadounidenses y las tarjetas se aceptan casi en todas partes. Algunos chiringuitos pequeños solo aceptan efectivo.`,
      },
      {
        q: `¿Es ${n} adecuada para familias con niños?`,
        a: `Sin duda. Bahías tranquilas, barcos familiares y travesías cortas la hacen muy apta para niños. Filtra por 'apto para familias' para ver las mejores opciones.`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `¿Cómo elijo el tour adecuado de ${c.toLowerCase()}?`,
        a: `Compara precio, duración y valoraciones. Cada página del tour detalla exactamente qué incluye, así encuentras fácil la mejor opción para tu grupo.`,
      },
      {
        q: `¿Hace falta reservar con antelación?`,
        a: `En temporada alta sí: las salidas populares se llenan rápido. La reserva se confirma al instante, sin esperas.`,
      },
      {
        q: `¿La cancelación es gratuita?`,
        a: `Sí, hasta el plazo de cancelación indicado en la página del tour. Después aplican las condiciones del operador.`,
      },
      {
        q: `¿Qué debo llevar?`,
        a: `Protector solar respetuoso con el arrecife, toalla, bañador y algo de efectivo para propinas. Lo demás se indica en cada tour.`,
      },
      {
        q: `¿Son aptos para niños?`,
        a: `Muchos sí: revisa los límites de edad en la página del tour. Los tours con la etiqueta 'apto para familias' son la opción más segura.`,
      },
      {
        q: `¿Incluyen transporte?`,
        a: `Algunos tours incluyen recogida en el hotel o la ofrecen como extra; si no, el punto de encuentro aparece claro en la página con un mapa.`,
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
        q: `Qual é a melhor época para visitar ${n}?`,
        a: `${n} é um destino para o ano inteiro. Os meses mais secos e ensolarados vão de janeiro a agosto; de setembro a dezembro a água está mais quente e a ilha mais tranquila.`,
      },
      {
        q: `Preciso reservar os passeios em ${n} com antecedência?`,
        a: `Na alta temporada os passeios populares esgotam rápido. A reserva online tem confirmação imediata e cancelamento grátis, então antecipar não tem risco.`,
      },
      {
        q: `Posso cancelar se meus planos mudarem?`,
        a: `Sim. Todo passeio tem cancelamento grátis até o prazo indicado na página, sem perguntas.`,
      },
      {
        q: `Como me desloco em ${n}?`,
        a: `Um carro alugado dá mais liberdade, mas muitos passeios incluem busca no hotel. Táxis são fáceis de achar: combine o preço antes de embarcar.`,
      },
      {
        q: `Dá para pagar em dólar ou cartão?`,
        a: `Dólares americanos e cartões são aceitos em quase todo lugar. Barraquinhas de praia menores às vezes só aceitam dinheiro.`,
      },
      {
        q: `${n} é boa para famílias com crianças?`,
        a: `Com certeza. Baías calmas, barcos familiares e travessias curtas tornam a ilha muito amigável para crianças. Filtre por 'ideal para famílias' para ver as melhores opções.`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `Como escolho o passeio certo de ${c.toLowerCase()}?`,
        a: `Compare preço, duração e avaliações. Cada página de passeio mostra exatamente o que está incluído, facilitando achar a melhor opção para o seu grupo.`,
      },
      {
        q: `Preciso reservar com antecedência?`,
        a: `Na alta temporada sim: as saídas populares lotam rápido. A reserva é confirmada na hora, sem espera.`,
      },
      {
        q: `O cancelamento é grátis?`,
        a: `Sim, até o prazo de cancelamento indicado na página do passeio. Depois disso valem as condições do operador.`,
      },
      {
        q: `O que devo levar?`,
        a: `Protetor solar que não agrida os recifes, toalha, roupa de banho e um pouco de dinheiro para gorjetas. O restante está indicado em cada passeio.`,
      },
      {
        q: `Os passeios são bons para crianças?`,
        a: `Muitos sim: confira os limites de idade na página do passeio. Os passeios com selo 'ideal para famílias' são a escolha mais segura.`,
      },
      {
        q: `O transporte está incluído?`,
        a: `Alguns passeios incluem busca no hotel ou oferecem como extra; nos demais, o ponto de encontro aparece claramente na página com mapa.`,
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
        q: `什么时候去${n}最合适？`,
        a: `${n}全年都适合游览。1 月至 8 月最干燥、阳光最充足；9 月至 12 月海水更温暖，游客也更少。`,
      },
      {
        q: `${n}的行程需要提前预订吗？`,
        a: `旺季热门行程很快售罄。在线预订即时确认且可免费取消，提前锁定没有任何风险。`,
      },
      {
        q: `行程有变可以取消吗？`,
        a: `可以。每个行程都支持在页面标明的时限前免费取消，无需说明理由。`,
      },
      {
        q: `在${n}如何出行？`,
        a: `租车最自由，许多行程也提供酒店接送。出租车随处可见，上车前请先谈好价格。`,
      },
      {
        q: `可以用美元或银行卡付款吗？`,
        a: `美元和银行卡几乎在所有地方都可使用，部分小型海滩餐吧只收现金。`,
      },
      {
        q: `${n}适合带孩子的家庭吗？`,
        a: `非常适合。平静的海湾、家庭友好的船只和较短的航程都很适合儿童。可筛选"适合家庭"标签查看最佳选择。`,
      },
    ],
    catFaqs: (c) => [
      {
        q: `如何挑选合适的${c}？`,
        a: `对比价格、时长和评分。每个行程页面都清楚列出包含内容，方便您为同行伙伴找到最佳选择。`,
      },
      {
        q: `需要提前预订吗？`,
        a: `旺季需要：热门出发时段很快订满。预订即时确认，无需等待。`,
      },
      {
        q: `可以免费取消吗？`,
        a: `可以，在行程页面标明的取消时限内免费取消，之后按运营商条款处理。`,
      },
      {
        q: `需要带什么？`,
        a: `珊瑚友好型防晒霜、毛巾、泳衣，以及少量现金用于小费。其余物品在各行程页面均有说明。`,
      },
      {
        q: `这些行程适合儿童吗？`,
        a: `许多都适合：请查看行程页面的年龄限制。带有"适合家庭"标签的行程是最稳妥的选择。`,
      },
      {
        q: `是否包含接送？`,
        a: `部分行程包含酒店接送或可加购；其余行程的集合地点都在页面上配有地图清晰标注。`,
      },
    ],
  },
};

/** Templates for a locale (undefined for en - the caller renders base English). */
export function tpl(locale: Locale): LocaleTemplates | null {
  if (locale === Locale.en) return null;
  return TEMPLATES[locale];
}
