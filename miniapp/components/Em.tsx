// Renders "plain *accent* plain": the starred part becomes the italic serif accent used across the studio site.
export function Em({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("*") ? (
          <span key={i} className="serif-em">
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
