/**
 * One figure in a customer stat row. Shared by the bookings and payments
 * views so the two headers stay visually identical.
 *
 * `hint` is for the quiet second line (what the figure is counted from).
 * Values are always passed in already-formatted - this component never does
 * money or date maths, so a number can never mean something different here
 * than it does in the table below it.
 */
export function CustomerStatCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className='rounded-lg border border-border bg-card p-4'>
            <p className='m-0 text-xs text-muted-foreground'>{label}</p>
            <p className='m-0 mt-1 text-xl font-semibold text-foreground'>
                {value}
            </p>
            {hint ? (
                <p className='m-0 mt-1 text-xs text-muted-foreground'>{hint}</p>
            ) : null}
        </div>
    );
}
