interface IconProps {
  size?: number
  className?: string
}

/**
 * Inline 24px stroke icons. Bundling them avoids an icon-font request on the
 * critical path, which matters for the sub-2s launch budget on mobile networks.
 * Every icon is decorative: labels always accompany them in the markup.
 */
function Svg({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
    <path d="M9.5 21v-6h5v6" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)

export const CommunityIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
    <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
  </Svg>
)

export const ToolsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
  </Svg>
)

export const ProfileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
)

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </Svg>
)

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z" />
    <path d="M5 4v16" />
  </Svg>
)

export const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.6 2.5 5.2 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8Z" />
  </Svg>
)

export const BookmarkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h12v17l-6-4-6 4Z" />
  </Svg>
)

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3.5V6.5M16 3.5V6.5" />
  </Svg>
)

export const MapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4 3.5 6.2v13.5L9 17.5l6 2.2 5.5-2.2V4L15 6.2Z" />
    <path d="M9 4v13.5M15 6.2V19.7" />
  </Svg>
)

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.4" />
    <path d="M12 17h.01" />
  </Svg>
)

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4.5 19h15" />
  </Svg>
)

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </Svg>
)

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
)

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12H4.5" />
    <path d="m10 6-6 6 6 6" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
)

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Svg>
)

export const OfflineIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3.5 21 21" />
    <path d="M8.2 12.4a5.5 5.5 0 0 1 3-1.3M5 9.2a10 10 0 0 1 3.2-2M19 9.2a10 10 0 0 0-8-2.6" />
    <path d="M12 18h.01" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)

export const TrendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 16 5-5 3.5 3.5L20 7" />
    <path d="M15 7h5v5" />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" />
  </Svg>
)

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z" />
  </Svg>
)

export const LogoMark = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect x="6" y="9" width="16" height="30" rx="2.5" fill="currentColor" opacity="0.92" />
    <rect x="24" y="14" width="16" height="25" rx="2.5" fill="currentColor" opacity="0.6" />
    <path d="M14 16h0M14 22h0" stroke="none" />
    <circle cx="33" cy="10" r="4" fill="currentColor" />
  </svg>
)
