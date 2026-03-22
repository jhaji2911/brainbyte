import { Byte, LeaderboardUser } from './types';

export const BYTES: Byte[] = [
  {
    id: '1',
    category: 'Vocab Word of the Day',
    title: 'Petrichor',
    content: 'The pleasant, earthy smell that frequently accompanies the first rain after a long period of warm, dry weather.',
    curatedBy: {
      name: 'EtymologyNow',
      avatar: 'https://picsum.photos/seed/etym/100/100',
    },
  },
  {
    id: '6',
    category: 'Micro-game',
    title: 'Morse Code: PULSE',
    content: 'Learn the secret language of signals. Each letter in P-U-L-S-E has a unique dot-dash sequence. Tap short for dot, hold for dash. Tap the button below to start the interactive lesson.',
    interactive: true,
    source: 'Interactive Byte',
    curatedBy: {
      name: 'Signal Academy',
      avatar: 'https://picsum.photos/seed/morse/100/100',
    },
  },
  {
    id: '7',
    category: 'Cognitive Science',
    title: 'The Spacing Effect',
    content: 'Information is retained far better when learning sessions are spaced out over time rather than crammed. Your brain needs sleep cycles to consolidate memories into long-term storage.',
    source: 'Cognitive Psychology Review',
  },
  {
    id: '8',
    category: 'Philosophy',
    title: "Occam's Razor",
    content: 'Among competing hypotheses, the one with fewest assumptions should be selected. Simpler explanations are, all else being equal, generally better than complex ones.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=1000',
  },
  {
    id: '2',
    category: 'Physics of Light',
    title: 'Why the Sky is Blue',
    content:
      "It's all about Rayleigh Scattering. Sunlight reaches Earth's atmosphere and is scattered in all directions by the gases and particles in the air. Blue light travels as shorter, smaller waves and is scattered more than the other colors, which is why we see a blue sky.",
    image: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=1000',
    source: 'NASA Science',
  },
  {
    id: '3',
    category: 'Psychology',
    title: 'The Pratfall Effect',
    content: 'Why highly competent people become more likable after making a mistake. Vulnerability is a social lubricant.',
    progress: 65,
    savedAt: '2 days ago',
  },
  {
    id: '4',
    category: 'Neuroscience',
    title: 'Myelin Sheaths',
    content: 'How repetitive practice physically insulates your neural pathways for speed.',
    savedAt: '2 days ago',
  },
  {
    id: '5',
    category: 'Productivity',
    title: 'Zeigarnik Effect',
    content: 'Our brains remember uncompleted or interrupted tasks better than completed ones.',
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=1000',
  },
];

export const LEADERBOARD: LeaderboardUser[] = [
  { id: '1', name: 'Sarah K.', xp: 14200, streak: 48, avatar: 'https://i.pravatar.cc/150?u=sarah' },
  { id: '2', name: 'Alex Chen', xp: 12850, streak: 102, avatar: 'https://i.pravatar.cc/150?u=alex' },
  { id: '3', name: 'Jordan_X', xp: 11400, streak: 31, avatar: 'https://i.pravatar.cc/150?u=jordan' },
  { id: '4', name: 'You', xp: 10920, streak: 12, avatar: 'https://i.pravatar.cc/150?u=me', isMe: true },
  { id: '5', name: 'Maya.Dev', xp: 9800, streak: 24, avatar: 'https://i.pravatar.cc/150?u=maya' },
  { id: '6', name: 'Lukas_01', xp: 9450, streak: 7, avatar: 'https://i.pravatar.cc/150?u=lukas' },
];
