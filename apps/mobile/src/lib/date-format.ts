const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * An Intl.DateTimeFormat for the locale and options, built once and then reused. Building one loads the
 * locale's data, which is slow, and a list of times would otherwise build one for every row on every render.
 */
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale} ${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formats.set(key, format);
  }
  return format;
}
