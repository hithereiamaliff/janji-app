const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * An Intl.DateTimeFormat for the locale and options, built once and then reused. Building one loads the
 * locale's data, which is slow, and a list of times would otherwise build one for every row on every render.
 */
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  // A format without a time zone keeps the device's zone from when it was built, so the device's current offset
  // is part of its key: one built before the phone moved to another zone isn't used after.
  const zone = options.timeZone ?? `device ${new Date().getTimezoneOffset()}`;
  const key = `${locale} ${zone} ${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formats.set(key, format);
  }
  return format;
}
