import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const FavouritesContext = createContext(null);

function withMembership(ids, productId, isMember) {
  const next = new Set(ids);
  if (isMember) next.add(productId);
  else next.delete(productId);
  return next;
}

export function FavouritesProvider({ children }) {
  const { isAuthenticated, email } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [status, setStatus] = useState('idle');

  // What the server last confirmed, what the shopper last asked for, how many
  // clicks each product has had, and a per-product chain that keeps requests in
  // click order so a double click always ends in the state the shopper meant.
  const confirmed = useRef(new Set());
  const wanted = useRef(new Map());
  const clicks = useRef(new Map());
  const queue = useRef(new Map());
  const session = useRef(0);

  useEffect(() => {
    session.current += 1;
    const mine = session.current;
    confirmed.current = new Set();
    wanted.current = new Map();
    clicks.current = new Map();
    queue.current = new Map();
    setIds(new Set());

    if (!isAuthenticated) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    api
      .getFavourites()
      .then((products) => {
        if (mine !== session.current) return;
        confirmed.current = new Set(products.map((product) => product.id));
        setIds(new Set(confirmed.current));
        setStatus('ready');
      })
      .catch(() => {
        if (mine === session.current) setStatus('error');
      });
  }, [isAuthenticated, email]);

  const isFavourite = useCallback((productId) => ids.has(productId), [ids]);

  const toggleFavourite = useCallback(
    (productId) => {
      if (!isAuthenticated) {
        return Promise.reject(new Error('Sign in to save favourites'));
      }
      if (status !== 'ready') {
        return Promise.reject(new Error('Your favourites are not loaded yet'));
      }

      const mine = session.current;
      const want = !(wanted.current.get(productId) ?? confirmed.current.has(productId));
      const click = (clicks.current.get(productId) ?? 0) + 1;
      clicks.current.set(productId, click);
      wanted.current.set(productId, want);
      setIds((current) => withMembership(current, productId, want));

      const send = async () => {
        if (mine !== session.current) return;
        try {
          if (want) await api.addFavourite(productId);
          else await api.removeFavourite(productId);
        } catch (error) {
          // Only the latest click puts the heart back; an earlier failure is
          // overtaken by whatever the shopper clicked next.
          if (mine === session.current && clicks.current.get(productId) === click) {
            const actual = confirmed.current.has(productId);
            wanted.current.set(productId, actual);
            setIds((current) => withMembership(current, productId, actual));
          }
          throw error;
        }
        if (mine === session.current) {
          if (want) confirmed.current.add(productId);
          else confirmed.current.delete(productId);
        }
      };

      const result = (queue.current.get(productId) ?? Promise.resolve()).then(send);
      queue.current.set(productId, result.catch(() => {}));
      return result;
    },
    [isAuthenticated, status],
  );

  const value = useMemo(
    () => ({ status, isFavourite, toggleFavourite }),
    [status, isFavourite, toggleFavourite],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error('useFavourites must be used within FavouritesProvider');
  }
  return context;
}
