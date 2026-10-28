import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';

export default function ProductCard({ item, onAdded }) {
  const { isAuthenticated, refreshBasket } = useAuth();
  const { status, isFavourite, toggleFavourite } = useFavourites();
  const [favouriteError, setFavouriteError] = useState('');
  const favourite = isFavourite(item.id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleAdd() {
    setLoading(true);
    setMessage('');
    try {
      await api.addToBasket(item.id);
      await refreshBasket();
      setMessage('Added!');
      onAdded?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFavourite() {
    setFavouriteError('');
    try {
      await toggleFavourite(item.id);
    } catch (error) {
      setFavouriteError(error.message);
    }
  }

  const favouriteLabel = favourite
    ? `Remove ${item.name} from favourites`
    : `Add ${item.name} to favourites`;

  return (
    <article className="card flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={item.picture_uri}
          alt={item.name}
          className="h-full w-full object-cover"
        />
        {isAuthenticated && (
          <button
            type="button"
            onClick={handleToggleFavourite}
            disabled={status !== 'ready'}
            aria-pressed={favourite}
            aria-label={favouriteLabel}
            title={status === 'error' ? "We couldn't load your favourites" : favouriteLabel}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-xl shadow transition hover:bg-white disabled:opacity-50"
          >
            <span aria-hidden="true" className={favourite ? 'text-rose-600' : 'text-slate-400'}>
              {favourite ? '♥' : '♡'}
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {item.brand_name} · {item.type_name}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-2 text-sm text-slate-500 line-clamp-2">{item.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-bold text-slate-900">${item.price.toFixed(2)}</p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Adding...' : 'Add to basket'}
          </button>
        </div>
        {message && <p className="text-xs font-medium text-emerald-600">{message}</p>}
        {favouriteError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {favouriteError}
          </p>
        )}
      </div>
    </article>
  );
}
