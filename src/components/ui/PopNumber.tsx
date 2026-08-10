/**
 * A figure that arrives instead of appearing: each character slides up out of a
 * blur, staggered left to right. Used for the numbers that carry a card — KPI
 * values, stat totals, scores — where the number *is* the content.
 *
 * The stagger index is capped at 3 because the stylesheet defines four delay
 * steps; past that every remaining character rides the last one, which keeps a
 * long figure from turning into a slow ripple.
 */
export default function PopNumber({ value }: { value: string | number }) {
  return (
    <span className="t-digit-group is-animating">
      {String(value).split('').map((ch, i) => (
        <span className="t-digit" key={i} data-stagger={Math.min(i, 3)}>{ch}</span>
      ))}
    </span>
  )
}
