// Lucide (lucide.dev, ISC) — inlined so stroke follows currentColor.
const S = ({ children, size = 16, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       style={{ verticalAlign: '-0.15em', flexShrink: 0 }} {...rest}>
    {children}
  </svg>
)

export const Minus = (p) => <S {...p}><path d="M5 12h14" /></S>

export const Square = (p) => <S {...p}><rect width="18" height="18" x="3" y="3" rx="2" /></S>

export const X = (p) => <S {...p}><path d="M18 6L6 18M6 6l12 12" /></S>

export const LayoutGrid = (p) => (
  <S {...p}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </S>
)

export const House = (p) => (
  <S {...p}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </S>
)

export const Star = (p) => (
  <S {...p}>
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z" />
  </S>
)

export const Clock = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </S>
)

export const Lock = (p) => (
  <S {...p}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </S>
)

export const Paperclip = (p) => (
  <S {...p}>
    <path d="m16 6l-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
  </S>
)

export const Reply = (p) => (
  <S {...p}>
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    <path d="m9 17l-5-5l5-5" />
  </S>
)

export const Search = (p) => (
  <S {...p}>
    <path d="m21 21l-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </S>
)

export const UserPlus = (p) => (
  <S {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6m3-3h-6" />
  </S>
)

export const Sliders = (p) => (
  <S {...p}>
    <path d="M10 5H3m9 14H3M14 3v4m2 10v4m5-9h-9m9 7h-5m5-14h-7m-6 5v4m0-2H3" />
  </S>
)

export const ChevronDown = (p) => <S {...p}><path d="m6 9l6 6l6-6" /></S>

export const ChevronUp = (p) => <S {...p}><path d="m18 15l-6-6l-6 6" /></S>

export const ChevronLeft = (p) => <S {...p}><path d="m15 18l-6-6l6-6" /></S>

export const ChevronRight = (p) => <S {...p}><path d="m9 18l6-6l-6-6" /></S>

export const ArrowUp = (p) => <S {...p}><path d="m5 12l7-7l7 7m-7 7V5" /></S>

export const Users = (p) => (
  <S {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </S>
)

export const MessageSquare = (p) => (
  <S {...p}>
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </S>
)

export const Settings = (p) => (
  <S {...p}>
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <circle cx="12" cy="12" r="3" />
  </S>
)

export const BellOff = (p) => (
  <S {...p}>
    <path d="M10.268 21a2 2 0 0 0 3.464 0M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742M2 2l20 20M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />
  </S>
)

export const RotateCcw = (p) => (
  <S {...p}>
    <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </S>
)

export const Save = (p) => (
  <S {...p}>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7" />
  </S>
)

export const FolderOpen = (p) => (
  <S {...p}>
    <path d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </S>
)

export const Info = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4m0-4h.01" />
  </S>
)

export const Bold = (p) => <S {...p}><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></S>

export const Italic = (p) => <S {...p}><path d="M19 4h-9m4 16H5M15 4L9 20" /></S>

export const Underline = (p) => <S {...p}><path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16" /></S>

export const Strikethrough = (p) => (
  <S {...p}><path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6m-2-8h16" /></S>
)

export const List = (p) => (
  <S {...p}><path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" /></S>
)

export const AlignLeft = (p) => <S {...p}><path d="M15 12H3m14 6H3M21 6H3" /></S>

export const AlignCenter = (p) => <S {...p}><path d="M17 12H7m12 6H5M21 6H3" /></S>

export const ClearFormat = (p) => (
  <S {...p}><path d="M4 7V4h16v3M5 20h6m2-16L8 20m7-5l5 5m0-5l-5 5" /></S>
)

export const MoreVertical = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </S>
)

export const Send = (p) => (
  <S {...p}>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zm7.318-19.539l-10.94 10.939" />
  </S>
)
