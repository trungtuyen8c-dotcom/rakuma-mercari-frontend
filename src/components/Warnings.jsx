// Soft warnings (E5, E6, E9) with a "save anyway" action.
export default function Warnings({ items, onForce, forceLabel }) {
  if (!items.length) return null;
  return (
    <div role="alert" className="alert">
      {items.map(w => <p key={w} className="text-danger">{w}</p>)}
      <div className="row-wrap">
        <button type="button" className="btn-link btn-link--tight" onClick={onForce}>{forceLabel}</button>
      </div>
    </div>
  );
}
