// Small inline SVG icons. All decorative: callers provide accessible labels.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 1.75h5.5L12.5 4.75v9.5h-8.5z" />
    <path d="M9.25 1.75v3.25h3.25M6 8h4.5M6 10.75h4.5" />
  </Svg>
)
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4l4 4-4 4" />
  </Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
)
export const DotsIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="3.5" cy="8" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="12.5" cy="8" r="1.25" />
  </Svg>
)
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25l3.25 3.25" />
  </Svg>
)
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4.25 4.25l.6 9h6.3l.6-9" />
  </Svg>
)
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
  </Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
)
export const RestoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5v2.5h2.5" />
  </Svg>
)
export const SmileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M5.75 9.5c.6.8 1.35 1.2 2.25 1.2s1.65-.4 2.25-1.2" />
    <path d="M6 6.5h.01M10 6.5h.01" strokeWidth="2" />
  </Svg>
)
export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 2.75h-3.5v10.5h3.5M10 5l3 3-3 3M13 8H6.5" />
  </Svg>
)
