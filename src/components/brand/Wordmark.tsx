import Mark from "./Mark";

/** "twogether" with the two-circle mark standing in for the "o". Sizes with the surrounding font size. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="twogether"
      className={`inline-flex items-center font-display font-extrabold leading-none tracking-[-0.03em] ${className}`}
    >
      <span aria-hidden>tw</span>
      <Mark width="1.15em" className="mx-[0.03em]" />
      <span aria-hidden>gether</span>
    </span>
  );
}
