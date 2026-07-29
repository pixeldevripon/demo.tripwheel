import { TranslationMatrix } from '@/components/translations/translation-matrix';

export default function TranslationsPage() {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>Translations</h1>
                    <p className='text-sm text-content-muted mt-1'>
                        Language completeness across the catalog - click a cell
                        to translate
                    </p>
                </div>
            </div>
            <TranslationMatrix />
        </div>
    );
}

