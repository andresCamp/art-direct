import type { FrameState } from './types'

export interface GalleryItem {
  id: string
  image: string
  label: string
  gradient: [string, string]
  frames: FrameState[]
  naturalWidth: number
  naturalHeight: number
  dominantColor: string
}

export const galleryItems: GalleryItem[] = [
  {
    id: 'napoleon',
    image: '/gallery/napoleon.webp',
    label: 'Napoleon Crossing the Alps, David',
    gradient: ['#4a3a2a', '#8a7a6a'],
    naturalWidth: 1200,
    naturalHeight: 1434,
    dominantColor: '#4a3a2a',
    frames: [
      // Mobile: tight on Napoleon — contain + zoom into the figure
      { breakpoint: 'base', scale: 2.5, translateX: -27, translateY: 34, objectFit: 'contain', objectPosition: 'center', transformOrigin: 'center' },
      // Tablet: cover, focused on upper body and gesture
      { breakpoint: 'lg', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '50% 20%', transformOrigin: 'center' },
      // Desktop: slightly more sky visible
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '50% 13%', transformOrigin: 'center' },
    ],
  },
  {
    id: 'wave',
    image: '/gallery/wave.webp',
    label: 'The Great Wave off Kanagawa, Hokusai',
    gradient: ['#1a3a5c', '#c8b88a'],
    naturalWidth: 1200,
    naturalHeight: 807,
    dominantColor: '#1a3a5c',
    frames: [
      // Mobile: centered on the wave
      { breakpoint: 'base', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '45% 50%', transformOrigin: 'center' },
      // Tablet: anchored left, showing wave and boats
      { breakpoint: 'lg', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'left', transformOrigin: 'center' },
      // Desktop: full composition with Fuji, anchored bottom
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'bottom', transformOrigin: 'center' },
    ],
  },
  {
    id: 'adam',
    image: '/gallery/adam.webp',
    label: 'The Creation of Adam, Michelangelo',
    gradient: ['#8a7a60', '#c4b8a0'],
    naturalWidth: 1200,
    naturalHeight: 545,
    dominantColor: '#8a7a60',
    frames: [
      // Mobile: the hands, the iconic moment
      { breakpoint: 'base', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '34% 50%', transformOrigin: 'center' },
      // Tablet: wider view showing both figures
      { breakpoint: 'lg', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '15% 50%', transformOrigin: 'center' },
      // Desktop: nearly full fresco
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '12% 50%', transformOrigin: 'center' },
    ],
  },
  {
    id: 'crows',
    image: '/gallery/crows.webp',
    label: 'Wheatfield with Crows, Van Gogh',
    gradient: ['#2a3a5c', '#c4a830'],
    naturalWidth: 1200,
    naturalHeight: 576,
    dominantColor: '#2a3a5c',
    frames: [
      // Mobile: the path and crows
      { breakpoint: 'base', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '62% 50%', transformOrigin: 'center' },
      // Tablet: wider sky and field
      { breakpoint: 'lg', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '71% 50%', transformOrigin: 'center' },
      // Desktop: full panorama
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '76% 50%', transformOrigin: 'center' },
    ],
  },
  {
    id: 'whaam',
    image: '/gallery/whaam.webp',
    label: 'Whaam!, Roy Lichtenstein',
    gradient: ['#7a8aa0', '#cc2222'],
    naturalWidth: 1200,
    naturalHeight: 480,
    dominantColor: '#7a8aa0',
    frames: [
      // Mobile: tight on the explosion — contain + zoom
      { breakpoint: 'base', scale: 5.68, translateX: -159, translateY: 2, objectFit: 'contain', objectPosition: 'center', transformOrigin: 'center' },
      // Tablet: cover, focused on impact side
      { breakpoint: 'lg', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '61% 50%', transformOrigin: 'center' },
      // Desktop: more of the full diptych
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: '53% 50%', transformOrigin: 'center' },
    ],
  },
]
