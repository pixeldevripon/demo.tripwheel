import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
    LegalPageShell,
    LegalTableScroller,
} from '@/components/frontend/legal/legal-page-shell';
import { isLocale } from '@/lib/constants/locales';

export const metadata: Metadata = { title: 'Cookie Policy' };

/**
 * Global legal page - text is the verbatim handover copy from
 * public/Legal Pages (change it only through Denley, per the README).
 */
export default async function CookiePolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    return (
        <LegalPageShell locale={locale} title='Cookie Policy'>
            <h2>In short</h2>
            <p>
                We use cookies and similar technologies to make
                www.island.tours work, to remember your choices, and, only if
                you agree, to understand how the site is used and to measure
                our advertising. Cookies that are not essential stay off until
                you turn them on. You are in control: you can change your
                choices at any time on our Manage Cookies page. This page
                explains what we use and how to manage it.
            </p>

            <h2>1. What cookies are</h2>
            <p>
                Cookies are small files that a website stores on your device.
                Similar technologies, such as pixels, tags, and local storage,
                do related things. We use both first-party items, set by us,
                and third-party items, set by providers such as Google, Meta,
                and Stripe. Some last only for your visit (session), and some
                stay longer (persistent).
            </p>

            <h2>2. How we group them, and the rule we follow</h2>
            <p>
                We group what we use into four categories. The rule is simple:
                the strictly necessary ones are always on because the site
                cannot work without them, and everything else stays off until
                you agree. We apply this off-by-default rule to everyone, and
                it is also a legal requirement in places such as the European
                Economic Area, the United Kingdom, Switzerland, and Curacao.
            </p>
            <ul>
                <li>
                    Strictly necessary. Needed to run the site, keep it
                    secure, let you log in, and take your payment. These do
                    not need your consent.
                </li>
                <li>
                    Functional and preferences. Remember choices such as your
                    language and currency.
                </li>
                <li>
                    Analytics. Help us understand how the site is used so we
                    can improve it. Only with your consent.
                </li>
                <li>
                    Advertising and measurement. Help us measure our
                    advertising and show you relevant tours. Only with your
                    consent.
                </li>
            </ul>

            <h2>3. The cookies and technologies we use</h2>
            <p>
                The list below describes the cookies and technologies we use,
                by category. We keep it accurate through our consent tool, and
                the live, current list with exact names and durations is shown
                in our cookie banner and on our Manage Cookies page. Some
                names and durations below are typical values that we confirm
                against the live list.
            </p>

            <h3>Strictly necessary</h3>
            <LegalTableScroller>
                <table>
                    <thead>
                        <tr>
                            <th>Cookie or item</th>
                            <th>Set by</th>
                            <th>Purpose</th>
                            <th>Typical duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Consent cookie</td>
                            <td>Cookiebot</td>
                            <td>Remembers your cookie choices</td>
                            <td>Up to 12 months</td>
                        </tr>
                        <tr>
                            <td>Session and login</td>
                            <td>Island Tours</td>
                            <td>Keeps you logged in to your booking</td>
                            <td>Session</td>
                        </tr>
                        <tr>
                            <td>Security</td>
                            <td>Island Tours</td>
                            <td>
                                Protects against fraud and keeps requests safe
                            </td>
                            <td>Session</td>
                        </tr>
                        <tr>
                            <td>Payment and fraud protection</td>
                            <td>Stripe</td>
                            <td>
                                Runs and protects the checkout. Not set on
                                tours where you pay nothing at booking
                            </td>
                            <td>Up to 1 year</td>
                        </tr>
                    </tbody>
                </table>
            </LegalTableScroller>

            <h3>Functional and preferences</h3>
            <LegalTableScroller>
                <table>
                    <thead>
                        <tr>
                            <th>Cookie or item</th>
                            <th>Set by</th>
                            <th>Purpose</th>
                            <th>Typical duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Language and currency</td>
                            <td>Island Tours</td>
                            <td>
                                Remembers your language and the currency you
                                chose
                            </td>
                            <td>Session to persistent</td>
                        </tr>
                    </tbody>
                </table>
            </LegalTableScroller>

            <h3>Analytics (only with your consent)</h3>
            <LegalTableScroller>
                <table>
                    <thead>
                        <tr>
                            <th>Cookie or item</th>
                            <th>Set by</th>
                            <th>Purpose</th>
                            <th>Typical duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Google Analytics</td>
                            <td>Google</td>
                            <td>
                                Measures how the site is used so we can
                                improve it
                            </td>
                            <td>Up to 2 years</td>
                        </tr>
                    </tbody>
                </table>
            </LegalTableScroller>

            <h3>Advertising and measurement (only with your consent)</h3>
            <LegalTableScroller>
                <table>
                    <thead>
                        <tr>
                            <th>Cookie or item</th>
                            <th>Set by</th>
                            <th>Purpose</th>
                            <th>Typical duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Google Ads</td>
                            <td>Google</td>
                            <td>
                                Measures the bookings that come from our
                                advertising
                            </td>
                            <td>Up to 90 days</td>
                        </tr>
                        <tr>
                            <td>Meta Pixel</td>
                            <td>Meta</td>
                            <td>
                                Measures bookings and shows relevant
                                advertising
                            </td>
                            <td>Up to 90 days</td>
                        </tr>
                        <tr>
                            <td>Referral memory</td>
                            <td>Island Tours</td>
                            <td>
                                Remembers how you reached our site, for
                                example a Google or Meta advertisement, so we
                                can attribute and measure your booking
                            </td>
                            <td>Up to 90 days</td>
                        </tr>
                    </tbody>
                </table>
            </LegalTableScroller>

            <p>
                We also measure some bookings server to server with Google and
                Meta, which means part of the measurement is sent from our
                systems rather than only from your browser. This advertising
                and measurement, in your browser or server side, takes place
                only with your consent, and we share a coded (hashed) form of
                details such as your email to match a booking to an
                advertisement. This is explained in our Privacy Policy.
            </p>

            <h2>4. How we ask for your consent</h2>
            <p>
                When you first visit, our cookie banner, managed by Cookiebot,
                asks whether you accept analytics and advertising cookies.
                Rejecting is as easy as accepting. Until you accept,
                non-essential cookies are not set, and through Google Consent
                Mode v2 the advertising and analytics tools stay switched off
                or limited until you agree. Your choice is remembered, and you
                can change it at any time.
            </p>

            <h2>5. How to manage or withdraw your consent</h2>
            <p>You are always in control:</p>
            <ul>
                <li>
                    On our site: open our Manage Cookies page to see your
                    choices and change them, or to turn cookies off again.
                    Withdrawing is as easy as giving consent.
                </li>
                <li>
                    In your browser: you can block or delete cookies in your
                    browser settings. If you block strictly necessary cookies,
                    parts of the site may not work.
                </li>
                <li>
                    Global Privacy Control: if your browser sends a Global
                    Privacy Control signal, we treat it as a request to opt
                    out of non-essential cookies and respect it.
                </li>
                <li>
                    Do Not Track: there is no agreed industry standard for Do
                    Not Track, so we do not rely on it. Please use the
                    controls above instead.
                </li>
            </ul>

            <h2>6. Third-party cookies</h2>
            <p>
                Some cookies are set by providers who have their own privacy
                and cookie terms. The main ones are Google, Meta, and Stripe.
                You can read how they use cookies on their own websites, and
                we link to their notices in our Privacy Policy. You can
                control advertising cookies through your choices on our site.
            </p>

            <h2>7. Legal basis</h2>
            <p>
                We set strictly necessary cookies because they are needed to
                provide the service you ask for. We set all other cookies and
                use the related technologies only with your consent, which you
                can withdraw at any time.
            </p>

            <h2>8. Changes to this policy</h2>
            <p>
                We may update this Cookie Policy, for example when our cookies
                or providers change. We will post the updated policy with a
                new date.
            </p>

            <h2>9. More information</h2>
            <p>
                This Cookie Policy should be read with our Privacy Policy and
                our Terms of Service. To manage your cookies, visit our Manage
                Cookies page. For any question, email{' '}
                <a href='mailto:info@island.tours'>info@island.tours</a>. It
                was last updated on 18 June 2026. Island Tours. Built by
                Islanders.
            </p>
        </LegalPageShell>
    );
}
