import { TranslationMatrix } from '@/components/translations/translation-matrix';

export default function TranslationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Translations</h1>
          <p className="text-sm text-content-muted mt-1">
            Language completeness across the catalog - click a cell to translate
          </p>
        </div>
      </div>
      <TranslationMatrix />
    </div>
  );
}
