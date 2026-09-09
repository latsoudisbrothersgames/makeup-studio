import { useEffect, useMemo, useState } from 'react';
import { lockedKeys } from '../data/unlocks';
import { playerStars } from '../storage/players';

/** Αστέρια και κλειδωμένα στοιχεία του τρέχοντος παιδιού· ενημερώνεται όταν αλλάζει ο πίνακας. */
export function usePlayerStars(name: string): { stars: number; locked: Set<string> } {
  const [stars, setStars] = useState(() => playerStars(name));
  useEffect(() => {
    const refresh = () => setStars(playerStars(name));
    refresh();
    window.addEventListener('makeup:players-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('makeup:players-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [name]);
  const locked = useMemo(() => lockedKeys(stars), [stars]);
  return { stars, locked };
}
