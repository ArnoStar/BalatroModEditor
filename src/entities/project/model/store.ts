// The projects in this browser (IndexedDB 'balatro-editor', store 'projects').
import { idb, STORES, uid } from '@/shared/lib';
import type { ModPackage } from '@/shared/lib/mod';
import type { Project, ProjectOrigin } from './types';

export async function list_projects(): Promise<Project[]> {
  const all = await idb(STORES.projects, 'readonly', (s) => s.getAll() as IDBRequest<Project[]>);
  return all.sort((a, b) => b.updated_at - a.updated_at);
}

export const load_project = (id: string) => idb(STORES.projects, 'readonly', (s) => s.get(id) as IDBRequest<Project | undefined>);
export const save_project = (p: Project) => idb(STORES.projects, 'readwrite', (s) => s.put(p)).then(() => undefined);
export const delete_project = (id: string) => idb(STORES.projects, 'readwrite', (s) => s.delete(id)).then(() => undefined);

/** a new project for a package (it always has `assets`, so its images are checked) */
export function new_project(pkg: ModPackage, origin: ProjectOrigin): Project {
  const now = Date.now();
  return { id: uid(), pkg: { ...pkg, assets: pkg.assets ?? {} }, art: {}, created_at: now, updated_at: now, origin };
}

export async function create_project(pkg: ModPackage, origin: ProjectOrigin): Promise<Project> {
  const p = new_project(pkg, origin);
  await save_project(p);
  return p;
}
