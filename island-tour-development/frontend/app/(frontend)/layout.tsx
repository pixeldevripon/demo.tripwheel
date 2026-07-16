import { SmoothScroll } from '@/components/frontend/smooth-scroll';

export default function FrontendLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // overflow-x-clip lets full-viewport (100vw) bleed sections - e.g. the hub
    // Discover banner - sit edge-to-edge without spawning a horizontal scrollbar
    // from the scrollbar-gutter difference. `clip` (not `hidden`) keeps sticky
    // descendants (the trips tab bar) working.
    return (
        <div className='frontend-root min-h-screen overflow-x-clip'>
          {/*   <SmoothScroll /> */}
            {children}
        </div>
    );
}

