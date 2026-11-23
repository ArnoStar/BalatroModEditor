// Installing the mod in the game (its library in this browser, shared/api/library.ts):
// on, for new runs, with Creative mode if asked.
import { game_library, mods_api, type InstalledMod } from '@/shared/api';
import { package_hash, type ModPackage } from '@/shared/lib/mod';

export async function installed_copy(id: string): Promise<InstalledMod | undefined> {
  try { return await game_library.get(id); } catch { return undefined; }
}

export async function install(pkg: ModPackage, published_hash: string | undefined, with_creative: boolean): Promise<InstalledMod> {
  const hash = await package_hash(pkg);
  const old = await installed_copy(pkg.id);
  const m: InstalledMod = {
    id: pkg.id, version: pkg.version, hash, name: pkg.name, enabled: true,
    // (the registry's copy when it is exactly the published package: runs then name it by hash)
    source: published_hash === hash ? 'registry' : 'file',
    installed_at: old?.installed_at ?? Date.now(), package: pkg,
  };
  await game_library.put(m);
  if (with_creative && !pkg.creative) {
    const has = await installed_copy('creative');
    if (!has) {
      const creative = await mods_api.download('creative');
      await game_library.put({
        id: 'creative', version: creative.version, hash: await package_hash(creative), name: creative.name, enabled: true,
        source: 'registry', official: true, installed_at: Date.now(), package: creative,
      });
    } else if (!has.enabled) {
      await game_library.put({ ...has, enabled: true });
    }
  }
  return m;
}

export const uninstall = (id: string) => game_library.remove(id);
