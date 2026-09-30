// Label + control + optional error. `error` makes the control aria-invalid via the caller.
export default function Field({ id, label, error, hint, hintColor, full, children }) {
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint != null && <p id={id + '-hint'} className="caption" style={{ letterSpacing: 'inherit', ...(hintColor ? { color: hintColor } : null) }}>{hint}</p>}
      {error && <p id={id + '-err'} className="text-danger">{error}</p>}
    </div>
  );
}

export const invalidProps = (id, error) => ({ id, 'aria-invalid': error ? 'true' : 'false', 'aria-describedby': id + '-err' });
