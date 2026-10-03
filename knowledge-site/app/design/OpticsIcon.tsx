import type { ReactNode } from 'react'

export type OpticsIconName =
  | 'lens' | 'objective' | 'iris' | 'mirror' | 'splitter' | 'detector' | 'source'
  | 'save' | 'undo' | 'redo' | 'import' | 'export' | 'report'
  | 'grid' | 'book' | 'layers' | 'arrowRight' | 'check' | 'search'
  | 'settings' | 'scan' | 'target' | 'optics' | 'chevronDown'

const shapes: Record<OpticsIconName, ReactNode> = {
  objective: <><path d="M5 3h14v5H5zM7 8v8l3 5h4l3-5V8M7 13h10M10 21v-3h4v3" /><path d="M3 5h2m14 0h2" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  lens: <><path d="M12 3C7.7 7.6 7.7 16.4 12 21C16.3 16.4 16.3 7.6 12 3Z" /><path d="M2.5 12H8M16 12h5.5" /></>,
  iris: <><circle cx="12" cy="12" r="9" /><path d="m11 3 5 5-1 6M20 8h-7l-4 4M20 17l-3-6-6-2M13 21l-5-5 1-6M4 16h7l4-4M4 7l3 6 6 2" /></>,
  mirror: <><path d="m5 19 14-14M8 20l-2-2m6-2-2-2m6-2-2-2m6-2-2-2M3 10h11V3m-3 3 3-3 3 3" /></>,
  splitter: <><path d="m5 19 14-14M2 12h20m-3-3 3 3-3 3M12 12V2m-3 3 3-3 3 3" /></>,
  detector: <><rect x="14" y="4" width="6" height="16" rx="1.5" /><path d="M4 8h10M4 12h10M4 16h10m-3-6 3 2-3 2" /></>,
  source: <><circle cx="5" cy="12" r="2.5" /><path d="M8 12h14M9 9l11-5M9 15l11 5m-2-11 4 3-4 3" /></>,
  save: <><path d="M5 3h12l4 4v14H3V3h2Z" /><path d="M7 3v6h9V3M7 21v-8h10v8M13 5v2" /></>,
  undo: <><path d="M3 10h11a6 6 0 0 1 0 12h-3M7 6l-4 4 4 4" transform="translate(0 -3)" /></>,
  redo: <><path d="M21 10H10a6 6 0 0 0 0 12h3M17 6l4 4-4 4" transform="translate(0 -3)" /></>,
  import: <><path d="M14 3h5v18H5v-7M2 9h12m-4-4 4 4-4 4" /></>,
  export: <><path d="M14 3H5v18h14v-7M10 9h12m-4-4 4 4-4 4" /></>,
  report: <><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h3" /><path d="M14 17v-3m2 3v-5" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>,
  book: <><path d="M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16M5 8h4M5 12h4M15 8h4M15 12h4" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5Zm-9 10 9 4 9-4M3 17l9 4 9-4" /></>,
  arrowRight: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  check: <><path d="m5 12 4.5 4.5L19 7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6M16 9v6M10 15v6" /></>,
  scan: <><path d="M3 3v18h18M6 16l4-5 4 2 6-7M13 3v3M13 17v3" /><circle cx="13" cy="12.5" r="2" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  optics: <><path d="M10 3C6.3 7.6 6.3 16.4 10 21C13.7 16.4 13.7 7.6 10 3Z" /><path d="M2 6h6m4 0 7 6h3M2 12h20M2 18h6m4 0 7-6" /></>,
}

export function OpticsIcon({ name, size = 20, className }: {
  name: OpticsIconName
  size?: number
  className?: string
}) {
  return <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ width: size, height: size, flexShrink: 0 }}
    className={`optics-icon${className ? ` ${className}` : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >{shapes[name]}</svg>
}
