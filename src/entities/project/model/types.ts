import type { ModPackage } from '@/shared/lib/mod';

/** a drawing's layers, kept so it can be edited again (the package keeps only the flattened PNG) */
export interface ArtLayer { name: string; visible: boolean; opacity: number; png: string }
export interface ArtSource { w: number; h: number; layers: ArtLayer[] }

export interface ProjectOrigin {
  kind: 'blank' | 'template' | 'example' | 'file' | 'game' | 'registry' | 'copy';
  /** the template's or example's name, the file's name … */
  ref?: string;
}

/** what was last published from here */
export interface Published { version: string; hash: string; at: number }

/** a mod being made, as this browser keeps it */
export interface Project {
  id: string;
  pkg: ModPackage;
  /** the drawings' layers, by asset name */
  art: Record<string, ArtSource>;
  created_at: number;
  updated_at: number;
  origin: ProjectOrigin;
  published?: Published;
}
