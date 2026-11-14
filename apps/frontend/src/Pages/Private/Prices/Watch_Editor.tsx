import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currencySymbol } from '../../../Hooks/Prices/formatPrice';

interface Watch_Editor_Props {
  // The current target (null = any sale); undefined = not followed yet
  targetPrice: number | null | undefined;
  currency: string;
  // Suggestion for a new target: a bit below the current price
  suggestion: number | null;
  busy?: boolean;
  onSave: (targetPrice: number | null) => Promise<boolean>;
  onCancel: () => void;
}

const parse = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};

/** When to be alerted: on any sale, or once the price is at or below a target. */
const Watch_Editor = ({ targetPrice, currency, suggestion, busy = false, onSave, onCancel }: Watch_Editor_Props) => {
  const { t } = useTranslation('prices');
  const id = useId();
  const [mode, setMode] = useState<'sale' | 'target'>(typeof targetPrice === 'number' ? 'target' : 'sale');
  const [value, setValue] = useState(
    typeof targetPrice === 'number' ? String(targetPrice) : suggestion !== null ? String(suggestion) : '',
  );
  const target = parse(value);
  const valid = mode === 'sale' || target !== null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    if (await onSave(mode === 'sale' ? null : target)) onCancel();
  };

  return (
    <form className='Watch_Editor' onSubmit={(e) => void submit(e)}>
      <fieldset>
        <legend>{t('editor.when')}</legend>
        <label className='Watch_Editor_Option'>
          <input type='radio' name={`${id}-mode`} checked={mode === 'sale'} onChange={() => setMode('sale')} />
          <span>{t('editor.anySale')}</span>
        </label>
        <label className='Watch_Editor_Option'>
          <input type='radio' name={`${id}-mode`} checked={mode === 'target'} onChange={() => setMode('target')} />
          <span>{t('editor.below')}</span>
        </label>
        <label className={`Watch_Editor_Amount${mode === 'target' ? '' : ' off'}`}>
          <span className='sr-only'>{t('editor.target')}</span>
          <input
            type='text'
            inputMode='decimal'
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setMode('target')}
            aria-invalid={mode === 'target' && target === null}
          />
          <span aria-hidden='true'>{currencySymbol(currency)}</span>
        </label>
      </fieldset>
      <div className='Watch_Editor_Actions'>
        <button type='submit' className='Prices_Solid' disabled={!valid || busy}>
          {targetPrice === undefined ? t('editor.follow') : t('editor.save')}
        </button>
        <button type='button' className='Prices_Link' onClick={onCancel}>
          {t('editor.cancel')}
        </button>
      </div>
    </form>
  );
};

export default Watch_Editor;
