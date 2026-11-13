interface LogoProps {
  color?: string;
}

// The GamesTracker Vault mark: a vault dial with a play button in the middle.
// The four notches read both as the dial's marks and as a crosshair.
const Logo = ({ color = 'currentColor' }: LogoProps) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2.2" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M10 8.6v6.8a.6.6 0 0 0 .9.5l5.4-3.4a.6.6 0 0 0 0-1L10.9 8.1a.6.6 0 0 0-.9.5z" fill={color} />
  </svg>
);

export default Logo;
