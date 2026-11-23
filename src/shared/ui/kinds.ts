import type { ItemKind } from '@/shared/lib/mod';
import type { IconName } from './icons';

/** each kind of item's icon and colour, everywhere in the editor */
export const KIND_ICON: Record<ItemKind, IconName> = { jokers: 'joker', consumables: 'tarot', vouchers: 'voucher', decks: 'deck', blinds: 'blind' };
export const KIND_TONE: Record<ItemKind, string> = { jokers: '#3d9bff', consumables: '#a782d1', vouchers: '#fd682b', decks: '#4bc292', blinds: '#e2574c' };
