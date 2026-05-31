import { CreditCard, RotateCcw, MessageCircle } from 'lucide-react';

const items = [
    {
        icon: CreditCard,
        title: 'Pay as little as 20% today',
        body: 'Secure your spot now, pay the rest later',
    },
    {
        icon: RotateCcw,
        title: 'Plans change. No problem.',
        body: 'Most tours fully refundable — cancel up to 24h before',
    },
    {
        icon: MessageCircle,
        title: 'Help when you need it',
        body: 'Chat 24/7 · WhatsApp anytime',
    },
];

export function TrustStrip() {
    return (
        <section className='bg-it-white border-b border-it-border'>
            <div className='it-container'>
                <div className='grid grid-cols-1 md:grid-cols-3 py-10'>
                    {items.map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={i}
                                className={[
                                    'flex items-start gap-4 px-8 py-4',
                                    i < items.length - 1 ? 'md:border-r border-it-border' : '',
                                ].join(' ')}
                            >
                                <div className='size-10 rounded-it-md bg-it-primary-subtle flex items-center justify-center shrink-0'>
                                    <Icon size={18} className='text-it-primary' />
                                </div>
                                <div>
                                    <p className='m-0 text-base font-semibold text-it-ink tracking-tight'>
                                        {item.title}
                                    </p>
                                    <p className='m-0 mt-1 text-sm text-it-ink-muted leading-snug'>
                                        {item.body}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
