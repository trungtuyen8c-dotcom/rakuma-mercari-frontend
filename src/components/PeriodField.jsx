import Field from './Field';

// Which open period a new row goes to. With one open period there is nothing to choose; with two, the default
// follows the date (newest period when there is no date), matching the server's rule.
export const targetPeriod = (store, periodId, date) => {
  const opens = store.openPeriods;
  return opens.find(p => p.id === periodId)
    || (date && opens.find(p => date >= p.start && date <= p.end))
    || store.openPeriod;
};

export default function PeriodField({ id, store, value, onChange, error }) {
  if (store.openPeriods.length < 2) return null;
  return (
    <Field id={id} label="Kỳ" error={error}>
      <select id={id} className="input" value={value} onChange={onChange}>
        <option value="">Tự theo ngày</option>
        {store.openPeriods.map(p => <option key={p.id} value={p.id}>Kỳ {p.label}</option>)}
      </select>
    </Field>
  );
}
