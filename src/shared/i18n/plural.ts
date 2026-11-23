// Plural forms, as each language has them (Intl.PluralRules): English one/other,
// Russian one/few/many ("1 предмет", "2 предмета", "5 предметов").

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other?: string };

/** a function picking a word's form for a number, in `locale`; `#` in the form is the number */
export function plurals(locale: string) {
  const rules = new Intl.PluralRules(locale);
  return (n: number, forms: PluralForms, shown: string = String(n)): string => {
    const form = forms[rules.select(n)] ?? forms.other ?? forms.many ?? forms.one ?? '';
    return form.replace('#', shown);
  };
}
