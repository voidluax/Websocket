export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#0b1120_0%,#04060b_60%)]" />

      {/* aurora blobs */}
      <div className="absolute left-[-15%] top-[-25%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(circle,rgba(200,240,74,0.13)_0%,transparent_60%)] blur-3xl [animation:aurora-a_22s_ease-in-out_infinite_alternate]" />
      <div className="absolute right-[-20%] top-[10%] h-[50vmax] w-[50vmax] rounded-full bg-[radial-gradient(circle,rgba(123,227,208,0.10)_0%,transparent_60%)] blur-3xl [animation:aurora-b_26s_ease-in-out_infinite_alternate]" />
      <div className="absolute bottom-[-30%] left-[20%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(circle,rgba(183,139,255,0.10)_0%,transparent_60%)] blur-3xl [animation:aurora-c_30s_ease-in-out_infinite_alternate]" />

      {/* grid */}
      <div className="grid-lines absolute inset-0" />

      {/* scanline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/20 to-transparent [animation:scan_7s_linear_infinite]" />

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_55%,rgba(4,6,11,0.7)_100%)]" />
    </div>
  );
}
