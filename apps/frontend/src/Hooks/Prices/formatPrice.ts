import { dateLocale } from '../../i18n';

/** 14.99 + "EUR" → "14,99 €" in the interface language. */
export const formatPrice = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(dateLocale(), { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

/** The currency's symbol alone ("€", "US$"), for the target price field. */
export const currencySymbol = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat(dateLocale(), { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
};
