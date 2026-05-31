const reviews = [
    {
        text: 'Absolutely magical evening on the water. The sunset was breathtaking and the crew made us feel so welcome. We booked another tour the very next day!',
        name: 'Anna M.',
        country: 'Netherlands',
        tour: 'Sunset Cruise',
        rating: 5,
    },
    {
        text: 'Klein Curaçao is paradise. Crystal clear water, white sand, and barely anyone there. The island tours team sorted everything perfectly — not a single stress.',
        name: 'James R.',
        country: 'United Kingdom',
        tour: 'Klein Curaçao Day Trip',
        rating: 5,
    },
    {
        text: "The buggy tour was the highlight of our Aruba trip. Our guide knew every hidden corner of the island. Can't recommend it enough for adventurous travelers.",
        name: 'Sofia L.',
        country: 'Germany',
        tour: 'Off-Road Buggy Tour',
        rating: 5,
    },
];

export function Testimonials() {
    return (
        <section className='it-section bg-it-surface'>
            <div className='it-container'>
                {/* Header */}
                <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10'>
                    <div>
                        <h2 className='m-0 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold text-it-ink tracking-[-0.03em]'>
                            Travelers love us
                        </h2>
                        <div className='flex items-center gap-2 mt-2'>
                            <span className='text-[var(--it-star-filled)] text-lg'>★★★★★</span>
                            <span className='text-xl font-bold text-it-ink'>4.8</span>
                            <span className='text-sm text-it-ink-muted'>on Trustpilot · 247 reviews</span>
                        </div>
                    </div>
                    <button className='shrink-0 px-6 py-2.5 rounded-it-full border border-it-border bg-it-white text-it-ink text-sm font-medium hover:bg-it-surface transition-colors'>
                        Read all reviews
                    </button>
                </div>

                {/* Review cards */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {reviews.map((review) => (
                        <div
                            key={review.name}
                            className='bg-it-white rounded-it-lg p-6 border border-it-border flex flex-col gap-4'
                        >
                            {/* Stars */}
                            <div className='flex gap-0.5'>
                                {Array.from({ length: review.rating }).map((_, i) => (
                                    <span key={i} className='text-[var(--it-star-filled)] text-sm'>★</span>
                                ))}
                            </div>

                            {/* Quote */}
                            <p className='m-0 text-base text-it-ink leading-relaxed flex-1'>
                                &ldquo;{review.text}&rdquo;
                            </p>

                            {/* Reviewer */}
                            <div className='flex items-center justify-between pt-2 border-t border-it-border'>
                                <div>
                                    <p className='m-0 text-sm font-semibold text-it-ink'>{review.name}</p>
                                    <p className='m-0 text-xs text-it-ink-muted'>{review.country}</p>
                                </div>
                                <span className='text-xs text-it-ink-muted bg-it-surface px-2.5 py-1 rounded-it-full'>
                                    {review.tour}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
