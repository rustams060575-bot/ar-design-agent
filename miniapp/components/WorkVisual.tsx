// Illustrative visuals for the three cases of "Selected work", drawn as inline SVG: no media files, no network,
// nothing that can fail to load. Content mirrors the live site (withardesign.com): panels are demo / illustrative.
// Animation is CSS only and runs while the card is on screen ([data-live="true"], see globals.css).
//
// Safe zone: the card frame crops the SVG (slice) and overlays "[ 01 / 03 ]" at the top and "open" at the bottom right,
// so every element lives between y = 70 and y = 350 of the 320 x 400 canvas.

const EM = "rgb(var(--em))";
const BLUE = "rgb(var(--blue))";
const LINE = "rgb(var(--line) / 0.28)";
const INK = "rgb(var(--ink))";
const DIM = "rgb(var(--dim))";
const MONO = "var(--font-mono), ui-monospace, monospace";

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 320 400"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      className="absolute inset-0 h-full w-full"
      style={{ fontFamily: MONO }}
    >
      {children}
    </svg>
  );
}

const cap = (x: number, y: number, text: string, color = DIM, anchor: "start" | "middle" | "end" = "start") => (
  <text x={x} y={y} fill={color} fontSize="9" letterSpacing="1.4" textAnchor={anchor}>
    {text}
  </text>
);

/** 4Minds AI: agent orchestration graph. */
function Agents() {
  const nodes = ["INPUT", "CRM_STREAM", "CORE ENGINE", "REASONING_V4", "OUTPUT", "ACTION_PLAN"];
  const y0 = 112;
  const step = 40;
  return (
    <Svg label="Agent orchestration graph, illustrative">
      {cap(160, 78, "4MINDS_ORCHESTRATOR // AGENT GRAPH", DIM, "middle")}
      {nodes.slice(0, -1).map((_, i) => (
        <line key={i} x1="160" y1={y0 + i * step + 14} x2="160" y2={y0 + (i + 1) * step - 14} stroke={LINE} strokeWidth="1" />
      ))}
      {nodes.slice(0, -1).map((_, i) => (
        <line
          key={`f${i}`}
          x1="160"
          y1={y0 + i * step + 14}
          x2="160"
          y2={y0 + (i + 1) * step - 14}
          stroke={EM}
          strokeWidth="1.5"
          strokeDasharray="4 10"
          className="wv-flow"
          style={{ animationDelay: `${i * -0.3}s` }}
        />
      ))}
      {nodes.map((n, i) => {
        const core = n === "CORE ENGINE";
        return (
          <g key={n}>
            <rect
              x={core ? 70 : 85}
              y={y0 + i * step - 14}
              width={core ? 180 : 150}
              height="28"
              rx="3"
              fill={core ? "rgb(var(--accent) / 0.28)" : "rgb(var(--elevated))"}
              stroke={core ? BLUE : LINE}
              strokeWidth="1"
              className={core ? "wv-pulse" : undefined}
            />
            <text x="160" y={y0 + i * step + 3} fill={core ? INK : "rgb(var(--sub))"} fontSize="10" letterSpacing="1.2" textAnchor="middle">
              {n}
            </text>
          </g>
        );
      })}
      {cap(28, 346, "DEMO · ILLUSTRATIVE")}
    </Svg>
  );
}

/** Veloce Pay: treasury terminal. */
function Treasury() {
  const bars = [34, 52, 40, 66, 48, 78, 58, 88, 70, 96];
  return (
    <Svg label="Treasury terminal, demo data">
      {cap(28, 78, "TREASURY TERMINAL UI")}
      {cap(292, 78, "DEMO", EM, "end")}
      <text x="28" y="124" fill={INK} fontSize="30" fontWeight="600" letterSpacing="-0.5">
        $64,210,900
      </text>
      {cap(28, 144, "INSTITUTIONAL LIQUIDITY · DEMO DATA")}
      <line x1="28" y1="160" x2="292" y2="160" stroke={LINE} />
      <g transform="translate(0,66) scale(1,0.6)">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="28" y1={196 + i * 40} x2="292" y2={196 + i * 40} stroke="rgb(var(--line) / 0.12)" vectorEffect="non-scaling-stroke" />
        ))}
        <path d="M28 306 L56 288 L84 296 L112 262 L140 272 L168 236 L196 246 L224 214 L252 222 L292 186 L292 340 L28 340 Z" fill="rgb(var(--em) / 0.10)" />
        <path
          d="M28 306 L56 288 L84 296 L112 262 L140 272 L168 236 L196 246 L224 214 L252 222 L292 186"
          fill="none"
          stroke={EM}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength="1"
          strokeDasharray="1"
          className="wv-draw"
        />
      </g>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={28 + i * 27}
          y={332 - h * 0.26}
          width="16"
          height={h * 0.26}
          rx="1"
          fill={i % 3 === 0 ? BLUE : "rgb(var(--blue) / 0.45)"}
          className="wv-bar"
          style={{ animationDelay: `${i * -0.35}s` }}
        />
      ))}
    </Svg>
  );
}

/** Kinetix: self-serve onboarding / PLG funnel and telemetry. */
function Funnel() {
  const stages = [
    { n: "VISIT", w: 240 },
    { n: "ENGAGE", w: 184 },
    { n: "SIGNUP", w: 128 },
    { n: "DEMO", w: 84 },
  ];
  return (
    <Svg label="Product-led growth funnel, illustrative">
      {cap(28, 78, "CLOUD TELEMETRY · PLG FUNNEL")}
      {cap(292, 78, "DEMO", EM, "end")}
      {stages.map((s, i) => (
        <g key={s.n}>
          <rect
            x={160 - s.w / 2}
            y={100 + i * 44}
            width={s.w}
            height="32"
            rx="3"
            fill={`rgb(var(--accent) / ${0.55 - i * 0.1})`}
            stroke={BLUE}
            strokeWidth="1"
            className="wv-pulse"
            style={{ animationDelay: `${i * -0.5}s` }}
          />
          <text x="160" y={100 + i * 44 + 20} fill={INK} fontSize="10" letterSpacing="1.4" textAnchor="middle">
            {s.n}
          </text>
        </g>
      ))}
      <line x1="28" y1="278" x2="292" y2="278" stroke={LINE} />
      {cap(28, 296, "SELF-SERVE ONBOARDING")}
      <g transform="translate(0,-26)">
        <path
          d="M28 352 L60 338 L92 346 L124 322 L156 332 L188 314 L220 324 L252 308 L292 316"
          fill="none"
          stroke={EM}
          strokeWidth="2"
          strokeLinejoin="round"
          pathLength="1"
          strokeDasharray="1"
          className="wv-draw"
        />
      </g>
      {cap(28, 346, "DEMO · ILLUSTRATIVE")}
    </Svg>
  );
}

export function WorkVisual({ id }: { id: string }) {
  if (id === "w1") return <Agents />;
  if (id === "w2") return <Treasury />;
  return <Funnel />;
}
