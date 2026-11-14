interface TagProps {
  color?: string;
}

// A price tag with its hole: prices and deals
const Tag = ({ color = 'currentColor' }: TagProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true">
    <path d="M3.5 12.6V4.8c0-.7.6-1.3 1.3-1.3h7.8c.35 0 .68.14.92.38l6.9 6.9c.5.5.5 1.33 0 1.84l-7.8 7.8c-.5.5-1.33.5-1.84 0l-6.9-6.9a1.3 1.3 0 0 1-.38-.92Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="8.2" cy="8.2" r="1.5" stroke={color} strokeWidth="1.5" />
  </svg>
);

export default Tag;
