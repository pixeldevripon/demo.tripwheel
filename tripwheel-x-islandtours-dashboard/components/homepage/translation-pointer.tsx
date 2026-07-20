import Link from 'next/link';

/**
 * English is edited inline; every other locale lives in the Translation
 * Console. Standing rule across this app, so each translatable homepage card
 * ends with this pointer rather than growing language tabs of its own.
 */
export function TranslationPointer() {
  return (
    <p className='text-xs text-content-muted'>
      English only here - translate into the other languages in the{' '}
      <Link
        href='/translations/homepage/default/es'
        className='underline underline-offset-4 hover:text-primary'
      >
        Translation Console
      </Link>
      .
    </p>
  );
}
