import type { FrameState } from './types'

export interface GalleryItem {
  id: string
  image: string
  label: string
  gradient: [string, string]
  frames: FrameState[]
}

export const galleryItems: GalleryItem[] = [
  {
    id: 'wave',
    image: '/gallery/wave.jpg',
    label: 'The Great Wave off Kanagawa, Hokusai',
    gradient: ['#1a3a5c', '#c8b88a'],
    frames: [
      // Mobile: tight on the wave crest
      { breakpoint: 'base', scale: 2.2, translateX: -4, translateY: 3, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'left' },
      // Tablet: wave and boats visible
      { breakpoint: 'md', scale: 1.3, translateX: -2, translateY: 0, objectFit: 'cover', objectPosition: 'left', transformOrigin: 'center' },
      // Desktop: full composition with Fuji
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
    ],
  },
  {
    id: 'adam',
    image: '/gallery/adam.jpg',
    label: 'The Creation of Adam, Michelangelo',
    gradient: ['#8a7a60', '#c4b8a0'],
    frames: [
      // Mobile: the hands, the iconic moment
      { breakpoint: 'base', scale: 3, translateX: 1, translateY: 2, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
      // Tablet: God reaching toward Adam
      { breakpoint: 'md', scale: 1.4, translateX: 2, translateY: 0, objectFit: 'cover', objectPosition: 'right', transformOrigin: 'center' },
      // Desktop: full fresco
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
    ],
  },
  {
    id: 'crows',
    image: '/gallery/crows.jpg',
    label: 'Wheatfield with Crows, Van Gogh',
    gradient: ['#2a3a5c', '#c4a830'],
    frames: [
      // Mobile: the ominous sky, crows in flight
      { breakpoint: 'base', scale: 1.8, translateX: 0, translateY: -4, objectFit: 'cover', objectPosition: 'top', transformOrigin: 'center' },
      // Tablet: sky meets the wheatfield path
      { breakpoint: 'md', scale: 1.2, translateX: 0, translateY: -1, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
      // Desktop: full panorama
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
    ],
  },
  {
    id: 'napoleon',
    image: '/gallery/napoleon.jpg',
    label: 'Napoleon Crossing the Alps, David',
    gradient: ['#4a3a2a', '#8a7a6a'],
    frames: [
      // Mobile: Napoleon's commanding gesture
      { breakpoint: 'base', scale: 1.6, translateX: 0, translateY: -6, objectFit: 'cover', objectPosition: 'top', transformOrigin: 'center' },
      // Tablet: horse and rider
      { breakpoint: 'md', scale: 1.1, translateX: 0, translateY: -2, objectFit: 'cover', objectPosition: 'top', transformOrigin: 'center' },
      // Desktop: full painting
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
    ],
  },
  {
    id: 'whaam',
    image: '/gallery/whaam.png',
    label: 'Whaam!, Roy Lichtenstein',
    gradient: ['#7a8aa0', '#cc2222'],
    frames: [
      // Mobile: the explosion, the payoff
      { breakpoint: 'base', scale: 2, translateX: 6, translateY: 0, objectFit: 'cover', objectPosition: 'right', transformOrigin: 'right' },
      // Tablet: jet firing into explosion
      { breakpoint: 'md', scale: 1.1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
      // Desktop: full diptych
      { breakpoint: 'xl', scale: 1, translateX: 0, translateY: 0, objectFit: 'cover', objectPosition: 'center', transformOrigin: 'center' },
    ],
  },
]
