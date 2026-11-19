export interface CameraFilter {
  id: string;
  name: string;
  cssFilter: string;
  overlayClass: string;
  swatchColor: string;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: 'original',
    name: 'Natural',
    cssFilter: 'none',
    overlayClass: '',
    swatchColor: '#e4e4e7',
  },
  {
    id: 'kodak',
    name: 'Warm 400',
    cssFilter: 'contrast(1.08) saturate(1.18) sepia(0.18) brightness(1.02)',
    overlayClass: 'bg-amber-500/10 mix-blend-soft-light',
    swatchColor: '#f59e0b',
  },
  {
    id: 'noir',
    name: 'Noir Grain',
    cssFilter: 'grayscale(1) contrast(1.28) brightness(0.95)',
    overlayClass: 'bg-zinc-950/10',
    swatchColor: '#52525b',
  },
  {
    id: 'cobalt',
    name: 'Blue Hour',
    cssFilter: 'contrast(1.12) saturate(1.08) hue-rotate(-10deg) brightness(0.96)',
    overlayClass: 'bg-sky-500/12 mix-blend-overlay',
    swatchColor: '#38bdf8',
  },
  {
    id: 'matte',
    name: 'Faded Matte',
    cssFilter: 'contrast(0.88) brightness(1.06) saturate(0.85)',
    overlayClass: 'bg-stone-500/12',
    swatchColor: '#a8a29e',
  },
  {
    id: 'vivid',
    name: 'Crisp Vivid',
    cssFilter: 'contrast(1.16) saturate(1.32) brightness(1.02)',
    overlayClass: '',
    swatchColor: '#fb7185',
  },
];

export function getFilterById(id?: string): CameraFilter {
  return CAMERA_FILTERS.find((f) => f.id === id) || CAMERA_FILTERS[0];
}
