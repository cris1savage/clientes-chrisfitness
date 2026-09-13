export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Chris Fitness logo"
    >
      {/* C — arco exterior con corte angular */}
      <path
        d="M72 14 L24 14 L12 26 L12 74 L24 86 L56 86 L72 66 L56 66 L32 66 L26 60 L26 40 L32 34 L72 34 L72 48 L86 48 L86 26 Z"
        fill="currentColor"
      />
      {/* F — barra superior */}
      <path d="M72 34 L86 34 L86 48 L72 48 Z" fill="currentColor" />
      {/* F — barra media */}
      <path d="M72 52 L84 52 L84 64 L72 64 Z" fill="currentColor" />
      {/* F — trazo diagonal hacia abajo */}
      <path d="M72 64 L82 64 L60 86 L48 86 Z" fill="currentColor" />
    </svg>
  );
}
