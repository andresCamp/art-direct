export type ObjectFit = 'cover' | 'contain' | 'fill'

export type BreakpointName = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface BreakpointDef {
  name: BreakpointName
  minWidth: number
  label: string
  prefix: string
}

export interface FrameState {
  breakpoint: BreakpointName
  scale: number
  translateX: number
  translateY: number
  objectFit: ObjectFit
  objectPosition: string
  transformOrigin: string
}

export interface ImageState {
  blobUrl: string
  filename: string
  naturalWidth: number
  naturalHeight: number
}

export type OutputFormat = 'img' | 'nextjs-image' | 'bg-div' | 'css' | 'agent-instruction'
export type DirectionKind = 'example' | 'upload' | 'blank'

export interface Direction {
  id: string
  name: string
  image: ImageState | null
  frames: FrameState[]
  dominantColor: string | null
  modifiedBreakpoints: Set<BreakpointName>
  lastModifiedBreakpoint: BreakpointName | null
  lastModifiedAt: number
  kind: DirectionKind
  exampleId?: string
}
