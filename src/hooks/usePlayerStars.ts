import { useEffect, useMemo, useState } from 'react';
import { shopLockedKeys } from '../data/shop';
import { lockedKeys } from '../data/unlocks';
import { playerCoins, playerOwned, playerStars } from '../storage/players';

/**
 * Αστέρια, νομίσματα, αγορές και κλειδωμένα στοιχεία του τρέχοντος παιδιού· ενημερώνεται όταν αλλάζει ο πίνακας.
 * `locked` = κλειδωμένα από αστέρια ∪ μη αγορασμένα από το κατάστημα.
 */
export function usePlayerStars(name: string): { stars: number; coins: number; owned: string[]; locked: Set<string> } {
  const [snap, setSnap] = useState(() => ({ stars: playerStars(name), coins: playerCoins(name), owned: playerOwned(name) }));
  useEffect(() => {
    const refresh = () => setSnap({ stars: playerStars(name), coins: playerCoins(name), owned: playerOwned(name) });
    refresh();
    window.addEventListener('makeup:players-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('makeup:players-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [name]);
  const locked = useMemo(() => {
    const out = lockedKeys(snap.stars);
    for (const k of shopLockedKeys(snap.owned)) out.add(k);
    return out;
  }, [snap.stars, snap.owned]);
  return { stars: snap.stars, coins: snap.coins, owned: snap.owned, locked };
}
