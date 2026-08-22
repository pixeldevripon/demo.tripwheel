import { NotFoundScreen } from '@/components/frontend/status/not-found-screen';

/**
 * The last-resort 404: any URL that matches no route at all, including the
 * locale-free surfaces (`/portal/...`, `/apply/...`) and anything the proxy
 * passes straight through.
 *
 * It renders outside the public-site layout, so it brings its own
 * `.frontend-root` (tokens + type) and fills the viewport instead of sitting
 * between a navbar and a footer. No island rail here: there is no locale
 * context to link into, so both actions hand a bare path to the proxy and let
 * it resolve the visitor's locale.
 */
export default function RootNotFound() {
    return (
        <div className='frontend-root flex flex-1 flex-col'>
            <NotFoundScreen fill='viewport' />
        </div>
    );
}
