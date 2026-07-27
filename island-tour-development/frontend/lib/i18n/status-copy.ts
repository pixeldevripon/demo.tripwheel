import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/constants/locales';

/**
 * Copy for the status screens (404 + error boundaries).
 *
 * Why this does NOT live in the dictionaries: `not-found.tsx` and `error.tsx`
 * receive no `params`, so a status screen can never be handed a locale by the
 * router - it has to read the locale off the pathname, in the browser. That
 * makes the copy client-side by construction, and `getDictionary()` is
 * server-only (`'use cache'` + dynamic import). Keeping every status string in
 * one small client-safe map beats splitting them across the dictionaries and a
 * second source: these five screens are the only consumers, and they all need
 * the same strings whether they render inside the locale tree (public 404) or
 * outside it (root 404, global error).
 *
 * Keep this list in sync with `ALL_LOCALES`.
 */

export type StatusCopy = {
    notFound: {
        title: string;
        description: string;
        /**
         * Primary CTA into the destination's All Tours archive (MCK-10).
         * `{destination}` is replaced with the island name; when no destination
         * resolves (root 404) the placeholder is stripped to a generic label.
         */
        primaryCta: string;
        secondaryCta: string;
        /** Label above the hub/category quick-link chips. */
        jumpLabel: string;
        /** "Still lost?" lead-in, WhatsApp link label, and trailing clause. */
        helpPrompt: string;
        helpLinkLabel: string;
        helpSuffix: string;
        /** "Popular right now" tour strip. */
        popularTitle: string;
        popularSubtitle: string;
        viewAllTours: string;
    };
    error: {
        eyebrow: string;
        title: string;
        description: string;
        primaryCta: string;
        secondaryCta: string;
    };
};

const STATUS_COPY: Record<Locale, StatusCopy> = {
    en: {
        notFound: {
            title: 'Page not found.',
            description:
                "The link may be broken or the page may have moved. Let's get you back to the good part.",
            primaryCta: 'Explore all {destination} tours',
            secondaryCta: 'Back to the homepage',
            jumpLabel: 'Or jump straight to',
            helpPrompt: 'Still lost?',
            helpLinkLabel: 'Message us on WhatsApp',
            helpSuffix: "and we'll point you the right way.",
            popularTitle: 'Popular right now',
            popularSubtitle: 'The trips travelers book most this season.',
            viewAllTours: 'View all {count} tours',
        },
        error: {
            eyebrow: 'Something went wrong',
            title: 'We could not load this page',
            description:
                'Give it another try. If it keeps happening, our team is already looking into it.',
            primaryCta: 'Try again',
            secondaryCta: 'Back to home',
        },
    },
    nl: {
        notFound: {
            title: 'Pagina niet gevonden.',
            description:
                'De link is mogelijk verbroken of de pagina is verplaatst. We brengen je terug naar het goede deel.',
            primaryCta: 'Ontdek alle tours op {destination}',
            secondaryCta: 'Terug naar de homepage',
            jumpLabel: 'Of ga direct naar',
            helpPrompt: 'Nog steeds verdwaald?',
            helpLinkLabel: 'Stuur ons een bericht op WhatsApp',
            helpSuffix: 'en we wijzen je de weg.',
            popularTitle: 'Nu populair',
            popularSubtitle:
                'De tours die reizigers dit seizoen het meest boeken.',
            viewAllTours: 'Bekijk alle {count} tours',
        },
        error: {
            eyebrow: 'Er is iets misgegaan',
            title: 'We konden deze pagina niet laden',
            description:
                'Probeer het nog een keer. Als het blijft gebeuren, kijkt ons team er al naar.',
            primaryCta: 'Opnieuw proberen',
            secondaryCta: 'Terug naar home',
        },
    },
    de: {
        notFound: {
            title: 'Seite nicht gefunden.',
            description:
                'Der Link ist möglicherweise defekt oder die Seite wurde verschoben. Wir bringen Sie zurück zum schönen Teil.',
            primaryCta: 'Alle Touren auf {destination} entdecken',
            secondaryCta: 'Zurück zur Startseite',
            jumpLabel: 'Oder direkt weiter zu',
            helpPrompt: 'Immer noch verloren?',
            helpLinkLabel: 'Schreiben Sie uns auf WhatsApp',
            helpSuffix: 'und wir zeigen Ihnen den Weg.',
            popularTitle: 'Gerade beliebt',
            popularSubtitle:
                'Die Touren, die Reisende diese Saison am häufigsten buchen.',
            viewAllTours: 'Alle {count} Touren ansehen',
        },
        error: {
            eyebrow: 'Etwas ist schiefgelaufen',
            title: 'Wir konnten diese Seite nicht laden',
            description:
                'Bitte versuchen Sie es erneut. Wenn es weiterhin auftritt, kümmert sich unser Team bereits darum.',
            primaryCta: 'Erneut versuchen',
            secondaryCta: 'Zur Startseite',
        },
    },
    fr: {
        notFound: {
            title: 'Page introuvable.',
            description:
                'Le lien est peut-être rompu ou la page a été déplacée. On vous ramène vers le meilleur.',
            primaryCta: 'Découvrir toutes les excursions à {destination}',
            secondaryCta: "Retour à l'accueil",
            jumpLabel: 'Ou accédez directement à',
            helpPrompt: 'Toujours perdu ?',
            helpLinkLabel: 'Écrivez-nous sur WhatsApp',
            helpSuffix: 'et nous vous guiderons.',
            popularTitle: 'Populaires en ce moment',
            popularSubtitle:
                'Les excursions les plus réservées cette saison.',
            viewAllTours: 'Voir les {count} excursions',
        },
        error: {
            eyebrow: 'Une erreur est survenue',
            title: "Nous n'avons pas pu charger cette page",
            description:
                'Réessayez. Si le problème persiste, notre équipe est déjà sur le coup.',
            primaryCta: 'Réessayer',
            secondaryCta: "Retour à l'accueil",
        },
    },
    es: {
        notFound: {
            title: 'Página no encontrada.',
            description:
                'Puede que el enlace esté roto o que la página se haya movido. Te llevamos de vuelta a lo bueno.',
            primaryCta: 'Explora todos los tours de {destination}',
            secondaryCta: 'Volver a la página de inicio',
            jumpLabel: 'O ve directamente a',
            helpPrompt: '¿Sigues perdido?',
            helpLinkLabel: 'Escríbenos por WhatsApp',
            helpSuffix: 'y te indicamos el camino.',
            popularTitle: 'Populares ahora mismo',
            popularSubtitle: 'Los tours más reservados esta temporada.',
            viewAllTours: 'Ver los {count} tours',
        },
        error: {
            eyebrow: 'Algo ha salido mal',
            title: 'No hemos podido cargar esta página',
            description:
                'Vuelve a intentarlo. Si sigue ocurriendo, nuestro equipo ya está en ello.',
            primaryCta: 'Intentar de nuevo',
            secondaryCta: 'Volver al inicio',
        },
    },
    pt: {
        notFound: {
            title: 'Página não encontrada.',
            description:
                'O link pode estar quebrado ou a página pode ter sido movida. Vamos levar você de volta à parte boa.',
            primaryCta: 'Explore todos os passeios de {destination}',
            secondaryCta: 'Voltar à página inicial',
            jumpLabel: 'Ou vá direto para',
            helpPrompt: 'Ainda perdido?',
            helpLinkLabel: 'Fale conosco no WhatsApp',
            helpSuffix: 'e mostramos o caminho.',
            popularTitle: 'Populares agora',
            popularSubtitle: 'Os passeios mais reservados nesta temporada.',
            viewAllTours: 'Ver os {count} passeios',
        },
        error: {
            eyebrow: 'Algo deu errado',
            title: 'Não conseguimos carregar esta página',
            description:
                'Tente novamente. Se continuar acontecendo, nossa equipe já está verificando.',
            primaryCta: 'Tentar novamente',
            secondaryCta: 'Voltar ao início',
        },
    },
    zh: {
        notFound: {
            title: '页面未找到。',
            description:
                '链接可能已失效，或页面已移动。让我们带你回到精彩的部分。',
            primaryCta: '探索{destination}全部行程',
            secondaryCta: '返回首页',
            jumpLabel: '或直接前往',
            helpPrompt: '还是找不到方向？',
            helpLinkLabel: '通过 WhatsApp 联系我们',
            helpSuffix: '，我们来为你指路。',
            popularTitle: '当前热门',
            popularSubtitle: '本季旅行者预订最多的行程。',
            viewAllTours: '查看全部 {count} 个行程',
        },
        error: {
            eyebrow: '出了点问题',
            title: '无法加载此页面',
            description: '请再试一次。如果问题持续出现，我们的团队已经在处理。',
            primaryCta: '重试',
            secondaryCta: '返回首页',
        },
    },
};

/** Status copy for a locale, falling back to English. */
export function getStatusCopy(locale: Locale = DEFAULT_LOCALE): StatusCopy {
    return STATUS_COPY[locale] ?? STATUS_COPY[DEFAULT_LOCALE];
}

/**
 * The locale a status screen should speak, read off the URL.
 *
 * `not-found.tsx` / `error.tsx` get no `params`, and the pathname is the only
 * signal that is right on a direct hit AND on a client navigation. Anything
 * outside the locale tree (`/portal/typo`, an unmatched root URL) has no locale
 * segment and falls back to English.
 */
export function localeFromPathname(pathname: string | null): Locale {
    const segment = pathname?.split('/')[1];
    return isLocale(segment) ? segment : DEFAULT_LOCALE;
}
