// Saving a mod as a file: the package's JSON (what the game imports, and what
// can be published), named after the mod and its version.
import { useI18n } from '@/shared/i18n';
import { download, package_file_name } from '@/shared/lib';
import type { ModPackage } from '@/shared/lib/mod';
import { Button, IconButton } from '@/shared/ui';

export function export_package(pkg: ModPackage) {
  download(package_file_name(pkg.id, pkg.version), JSON.stringify(pkg, null, 2) + '\n');
}

export function ExportButton({ pkg, icon_only, size = 'md', tone = 'secondary' }: {
  pkg: ModPackage; icon_only?: boolean; size?: 'sm' | 'md'; tone?: 'secondary' | 'ghost' | 'primary';
}) {
  const { t } = useI18n();
  if (icon_only) return <IconButton icon="download" label={t.workspace.export} size={size} onClick={() => export_package(pkg)} />;
  return <Button icon="download" size={size} tone={tone} onClick={() => export_package(pkg)}>{t.workspace.export}</Button>;
}
