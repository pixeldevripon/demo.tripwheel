/**
 * FAQ content - single source of truth for the accordion
 * (components/marketing/faq.tsx) and the FAQPage JSON-LD (app/page.tsx).
 */
export const FAQS: { question: string; answer: string }[] = [
    {
        question: 'What is TripWheel?',
        answer: 'TripWheel is the operating system for travel agencies and tour operators - turning fragmented bookings, customers, payments, and supplier data into clear decisions, governed workflows, and measurable growth.',
    },
    {
        question:
            'Is TripWheel a replacement for our booking engine, CRM, or accounting tools?',
        answer: 'TripWheel unifies the day-to-day operations of your agency - bookings, itineraries, customers, and payments - in one place. It connects to the channels and tools you already sell through, so you can consolidate gradually instead of ripping everything out on day one.',
    },
    {
        question: 'How does TripWheel work?',
        answer: 'You bring your tours, your team, and your channels. TripWheel centralises reservations and traveler details, automates the busywork - confirmations, itineraries, payment collection, supplier payouts - and gives you live reporting across every branch and channel.',
    },
    {
        question: 'Is TripWheel just another analytics dashboard?',
        answer: 'No. Analytics is only one layer - TripWheel is where the work actually happens: your team manages bookings, collects payments, and runs automated workflows inside the platform, and the reporting reflects that operational truth in real time.',
    },
    {
        question: 'Can we trust TripWheel with our customer data?',
        answer: 'Yes. Data is encrypted in transit and at rest, access is role-based and fully audited, and the platform is operated to ISO-aligned and GDPR-compliant standards. Your customer data is never sold or shared.',
    },
    {
        question: 'Will TripWheel fit our existing workflow?',
        answer: 'TripWheel is configurable to how your agency already operates - your team roles, your approval steps, your sales channels. Most teams are fully onboarded within a week, with migration support included on every plan.',
    },
];
