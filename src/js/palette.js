export const C = { navy: '#1c2030', rust: '#b4634a', blue: '#6e8ba5', pink: '#dcc5ba', light: '#e6d8ce' };
export const MUTED = '#b4b8c2';

export const LAYERS = [
  { name: 'Collect', sentence: 'Everything else depends on data that arrives complete and on time.', col: C.rust, dark: '#7e4434' },
  { name: 'Refine', sentence: 'AI is only as good as the data it can trust.', col: C.blue, dark: '#4b6378' },
  { name: 'Act', sentence: 'Data creates value only when it changes what people and systems do.', col: C.pink, dark: '#ad978d' },
];

export const NET_NODES = [[-.3, -.28], [.05, -.33], [.32, -.12], [-.12, -.02], [.2, .2], [-.3, .25], [.02, .32]];
export const NET_EDGES = [[0, 1], [0, 3], [1, 2], [1, 3], [3, 4], [2, 4], [3, 5], [5, 6], [4, 6]];
export const NET_HUB = 3;
