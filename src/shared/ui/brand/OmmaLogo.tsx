/**
 * Omma brand mark and lockup, from the Omma logo pack (lettering is outlined,
 * so no font is needed). The outline and letters follow `currentColor`, so they
 * read as ink on light themes and ivory on dark ones; the cell is always teal.
 */

export const OMMA_TEAL = '#36B5AC'

const OUTLINE = '1.6,9.6 -5.33,5.6 -5.33,-2.4 1.6,-6.4 8.53,-2.4 8.53,5.6'
const CELL = '-7.6,-4.4 -10.2,-5.9 -10.2,-8.9 -7.6,-10.4 -5,-8.9 -5,-5.9'
const WORDMARK = 'M12.88 0.59Q9.77 0.59 7.32 -0.68Q4.87 -1.95 3.47 -4.34Q2.06 -6.73 2.06 -10.06V-10.7Q2.06 -14.02 3.47 -16.41Q4.87 -18.8 7.32 -20.08Q9.77 -21.35 12.88 -21.35Q15.99 -21.35 18.44 -20.08Q20.89 -18.8 22.3 -16.41Q23.7 -14.02 23.7 -10.7V-10.06Q23.7 -6.73 22.3 -4.34Q20.89 -1.95 18.44 -0.68Q15.99 0.59 12.88 0.59ZM12.88 -3.69Q15.52 -3.69 17.21 -5.39Q18.89 -7.09 18.89 -10.18V-10.58Q18.89 -13.67 17.22 -15.37Q15.56 -17.07 12.88 -17.07Q10.25 -17.07 8.56 -15.37Q6.87 -13.67 6.87 -10.58V-10.18Q6.87 -7.09 8.56 -5.39Q10.25 -3.69 12.88 -3.69Z M27.56 0V-20.76H32.28V-18.42H32.99Q33.55 -19.48 34.84 -20.3Q36.12 -21.11 38.26 -21.11Q40.53 -21.11 41.91 -20.2Q43.29 -19.29 44 -17.87H44.71Q45.42 -19.26 46.76 -20.18Q48.1 -21.11 50.55 -21.11Q52.51 -21.11 54.08 -20.28Q55.66 -19.46 56.59 -17.82Q57.52 -16.18 57.52 -13.74V0H52.72V-13.39Q52.72 -15.19 51.76 -16.13Q50.8 -17.07 49.06 -17.07Q47.15 -17.07 46.05 -15.85Q44.94 -14.62 44.94 -12.32V0H40.14V-13.39Q40.14 -15.19 39.18 -16.13Q38.22 -17.07 36.48 -17.07Q34.57 -17.07 33.47 -15.85Q32.37 -14.62 32.37 -12.32V0Z M62.21 0V-20.76H66.93V-18.42H67.64Q68.2 -19.48 69.49 -20.3Q70.77 -21.11 72.91 -21.11Q75.18 -21.11 76.56 -20.2Q77.94 -19.29 78.65 -17.87H79.36Q80.07 -19.26 81.41 -20.18Q82.75 -21.11 85.2 -21.11Q87.16 -21.11 88.73 -20.28Q90.31 -19.46 91.24 -17.82Q92.17 -16.18 92.17 -13.74V0H87.37V-13.39Q87.37 -15.19 86.41 -16.13Q85.45 -17.07 83.71 -17.07Q81.8 -17.07 80.7 -15.85Q79.59 -14.62 79.59 -12.32V0H74.79V-13.39Q74.79 -15.19 73.83 -16.13Q72.87 -17.07 71.13 -17.07Q69.22 -17.07 68.12 -15.85Q67.02 -14.62 67.02 -12.32V0Z M103.29 0.59Q101.08 0.59 99.32 -0.18Q97.56 -0.95 96.53 -2.43Q95.51 -3.91 95.51 -6.03Q95.51 -8.16 96.53 -9.59Q97.56 -11.02 99.37 -11.74Q101.17 -12.47 103.48 -12.47H109.5V-13.72Q109.5 -15.37 108.49 -16.39Q107.48 -17.42 105.34 -17.42Q103.24 -17.42 102.17 -16.44Q101.09 -15.46 100.76 -13.89L96.31 -15.37Q96.81 -17 97.92 -18.35Q99.03 -19.69 100.89 -20.52Q102.75 -21.35 105.41 -21.35Q109.48 -21.35 111.83 -19.3Q114.17 -17.25 114.17 -13.39V-5.25Q114.17 -3.99 115.35 -3.99H117.08V0H113.7Q112.19 0 111.22 -0.76Q110.26 -1.52 110.26 -2.79V-2.88H109.53Q109.29 -2.3 108.66 -1.47Q108.02 -0.64 106.74 -0.03Q105.46 0.59 103.29 0.59ZM104.08 -3.34Q106.48 -3.34 107.99 -4.71Q109.5 -6.07 109.5 -8.39V-8.83H103.8Q102.21 -8.83 101.26 -8.14Q100.31 -7.46 100.31 -6.18Q100.31 -4.9 101.3 -4.12Q102.29 -3.34 104.08 -3.34Z'

type Props = { size?: number; className?: string; title?: string }

/** The facet mark on its own. `size` is the height in px. */
export function OmmaMark({ size = 24, className, title }: Props) {
  return (
    <svg
      viewBox="-11.4 -11.6 22.63 23.9"
      height={size}
      width={size * (22.63 / 23.9)}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <polygon points={OUTLINE} fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <polygon points={CELL} fill={OMMA_TEAL} />
    </svg>
  )
}

/** Mark + "omma" lettering side by side. `size` is the height in px. */
export function OmmaLockup({ size = 24, className, title = 'Omma' }: Props) {
  return (
    <svg
      viewBox="-68.511 -43.254 191.590 65.750"
      height={size}
      width={size * (191.590 / 65.750)}
      className={className}
      role="img"
      aria-label={title}
    >
      <g transform="translate(-37.011,-11.254) scale(2.50000)">
        <polygon points={OUTLINE} fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
        <polygon points={CELL} fill={OMMA_TEAL} />
      </g>
      <path fill="currentColor" d={WORDMARK} />
    </svg>
  )
}
