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
        eyebrow: string;
        title: string;
        description: string;
        primaryCta: string;
        secondaryCta: string;
        islandsLabel: string;
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
            eyebrow: 'Error 404',
            title: 'This page has drifted off the map',
            description:
                'The link may be broken, or the page may have moved. Let us get you back to the islands.',
            primaryCta: 'Back to home',
            secondaryCta: 'Search tours',
            islandsLabel: 'Popular islands',
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
            eyebrow: 'Fout 404',
            title: 'Deze pagina is van de kaart verdwenen',
            description:
                'De link is mogelijk verbroken of de pagina is verplaatst. Wij brengen je terug naar de eilanden.',
            primaryCta: 'Terug naar home',
            secondaryCta: 'Tours zoeken',
            islandsLabel: 'Populaire eilanden',
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
            eyebrow: 'Fehler 404',
            title: 'Diese Seite ist von der Karte verschwunden',
            description:
                'Der Link ist möglicherweise defekt oder die Seite wurde verschoben. Wir bringen Sie zurück zu den Inseln.',
            primaryCta: 'Zur Startseite',
            secondaryCta: 'Touren suchen',
            islandsLabel: 'Beliebte Inseln',
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
            eyebrow: 'Erreur 404',
            title: 'Cette page a disparu de la carte',
            description:
                'Le lien est peut-être rompu ou la page a été déplacée. Nous vous ramenons vers les îles.',
            primaryCta: "Retour à l'accueil",
            secondaryCta: 'Rechercher des excursions',
            islandsLabel: 'Îles populaires',
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
            eyebrow: 'Error 404',
            title: 'Esta página se salió del mapa',
            description:
                'Puede que el enlace esté roto o que la página se haya movido. Te llevamos de vuelta a las islas.',
            primaryCta: 'Volver al inicio',
            secondaryCta: 'Buscar tours',
            islandsLabel: 'Islas populares',
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
            eyebrow: 'Erro 404',
            title: 'Esta página saiu do mapa',
            description:
                'O link pode estar quebrado ou a página pode ter sido movida. Vamos levar você de volta às ilhas.',
            primaryCta: 'Voltar ao início',
            secondaryCta: 'Procurar passeios',
            islandsLabel: 'Ilhas populares',
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
            eyebrow: '错误 404',
            title: '这个页面已经偏离了航线',
            description: '链接可能已失效，或页面已移动。让我们带你回到海岛。',
            primaryCta: '返回首页',
            secondaryCta: '搜索行程',
            islandsLabel: '热门海岛',
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
