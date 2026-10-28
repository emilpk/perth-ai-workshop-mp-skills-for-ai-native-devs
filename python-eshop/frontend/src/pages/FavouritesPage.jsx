import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useFavourites } from '../context/FavouritesContext';

export default function FavouritesPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { status, isFavourite } = useFavourites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggleError, setToggleError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/favourites' } });
      return;
    }

    api
      .getFavourites()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  if (loading || status === 'loading') {
    return <p className="text-center text-slate-500">Loading favourites...</p>;
  }

  // A card unmounts as soon as it is un-favourited, so a failed removal is
  // reported here; the card's own message would be lost with it.
  // The list is fetched once for the product details; the heart state decides
  // what is still shown, so un-favouriting removes a card at once and a failed
  // removal brings it back.
  const favourites = products.filter((product) => isFavourite(product.id));
  const failed = error || toggleError || (status === 'error' ? "We couldn't load your favourites." : '');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My favourites</h1>
        <p className="mt-1 text-slate-500">Products you have saved, newest first.</p>
      </div>

      {failed && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{failed}</p>}

      {!failed && favourites.length === 0 && (
        <div className="card text-center">
          <p className="text-slate-500">
            You have no favourites yet. Tap the heart on a product to save it here.
          </p>
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Browse the catalog
          </Link>
        </div>
      )}

      {favourites.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((product) => (
            <ProductCard key={product.id} item={product} onFavouriteError={setToggleError} />
          ))}
        </div>
      )}
    </div>
  );
}
