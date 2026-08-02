/**
 * The shared chrome of every /cancel state.
 *
 * The page has four terminal states (verify, request-already-pending,
 * not-active, window-closed) plus the request form itself, and each one was
 * spelling out this same shell, the same 18px title and the same 14px muted
 * body by hand - five copies, including that unnamed shadow literal. They must
 * stay identical or the states visibly differ from one another as a traveller
 * moves between them, and a magic value repeated five times drifts on the first
 * design tweak that only reaches four.
 *
 * Class strings rather than a component so the server-rendered page and the
 * client-rendered form can both use them without a boundary crossing.
 */

export const CANCEL_CARD_SHELL =
    'w-full max-w-107.5 rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)]';

export const CANCEL_CARD_TITLE =
    'font-normal text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading';

export const CANCEL_CARD_BODY =
    'mt-2.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted';

/** Filled CTA - used only where the action moves the traveller forward. */
export const CANCEL_CARD_CTA_PRIMARY =
    'mt-4 inline-block w-fit rounded-[10px] bg-it-primary px-4.5 py-2.75 text-[14px] font-normal leading-[1.2] text-it-white no-underline transition-colors duration-300 hover:bg-it-primary-hover';

/** Outline CTA - the "nothing to do here, go look at the booking" exits. */
export const CANCEL_CARD_CTA_OUTLINE =
    'mt-4 inline-block w-fit rounded-[10px] border-[1.5px] border-it-heading/20 px-4.5 py-2.75 text-[14px] font-normal leading-[1.2] text-it-heading no-underline transition-colors duration-300 hover:border-it-heading/40';
