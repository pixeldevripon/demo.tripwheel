import { Navbar } from '@/components/frontend/navbar';
import { Hero } from '@/components/frontend/hero';
import { TrustStrip } from '@/components/frontend/trust-strip';
import { TopExperiences } from '@/components/frontend/top-experiences';
import { Testimonials } from '@/components/frontend/testimonials';
import { ExploreIslands } from '@/components/frontend/explore-islands';
import { EditorialBanner } from '@/components/frontend/editorial-banner';
import { FaqSection } from '@/components/frontend/faq-section';
import { Footer } from '@/components/frontend/footer';

export default function HomePage() {
    return (
        <>
            <Navbar />
            <main className='pt-20'>
                <Hero />
                <TrustStrip />
                <TopExperiences />
                <Testimonials />
                <ExploreIslands />
                <EditorialBanner />
                <FaqSection />
            </main>
            <Footer />
        </>
    );
}
