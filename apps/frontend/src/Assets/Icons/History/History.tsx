interface HistoryProps {
  color?: string;
}

// A clock with an arrow turning back: past conversations
const History = ({ color = 'currentColor' }: HistoryProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true">
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4l3 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default History;
