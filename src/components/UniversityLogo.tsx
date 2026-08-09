import { useState } from 'react'
import { LogoMark } from './icons'

/**
 * The University of Jos emblem.
 *
 * It is loaded from `public/logo-unijos.svg` rather than inlined, so swapping in
 * the official asset is a one-file change with no rebuild of any component. If
 * the file is missing or fails to load, the built-in REACH mark takes its place
 * so the header never collapses.
 *
 * `public/logo-unijos.png` is tried before falling back, which lets a raster
 * version of the official logo be dropped in just as easily.
 */
export function UniversityLogo({ size = 44, className }: { size?: number; className?: string }) {
  const [attempt, setAttempt] = useState(0)
  const sources = [`${import.meta.env.BASE_URL}logo-unijos.svg`, `${import.meta.env.BASE_URL}logo-unijos.png`]

  if (attempt >= sources.length) {
    return <LogoMark size={size} />
  }

  return (
    <img
      className={className}
      src={sources[attempt]}
      width={size}
      height={size}
      alt="University of Jos"
      decoding="async"
      onError={() => setAttempt((current) => current + 1)}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}
