/**
 * The `@modal` slot's resting state: nothing. The slot only ever fills when an
 * in-app navigation is intercepted (today: the operator-conditions overlay at
 * `(.)operators/[operatorSlug]/conditions`); every other route - and every
 * hard load - renders this null fallback.
 */
export default function ModalSlotDefault() {
    return null;
}
