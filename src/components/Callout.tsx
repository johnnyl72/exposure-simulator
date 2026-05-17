// Handwritten annotation — ported from the wireframe `Callout`.
// Pure presentational marginalia in the sketch voice.

export function Callout({
  text,
  style,
}: {
  text: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="wf-anno" style={{ position: 'absolute', ...style }}>
      {text.split('\n').map((line, i) => (
        <span key={i}>
          {line}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}
