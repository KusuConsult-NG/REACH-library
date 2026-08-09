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
 * `public/logo-unijos.svg` is tried next, so a vector version of the crest can
 * replace the raster one without a code change.
 */
export function UniversityLogo({ size = 44, className }: { size?: number; className?: string }) {
  const [attempt, setAttempt] = useState(0)
  const sources = [`${import.meta.env.BASE_URL}logo-unijos.png`, `${import.meta.env.BASE_URL}logo-unijos.svg`]

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

/**
 * The full "University of Jos" wordmark, for the sign-in screen where there is
 * room for it. Same drop-in rule as the crest: replace
 * `public/logo-unijos-wordmark.png` and nothing else changes.
 */
export function UniversityWordmark({ width = 232 }: { width?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-unijos-wordmark.png`}
      alt="University of Jos"
      width={width}
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width, height: 'auto', maxWidth: '100%' }}
    />
  )
}
