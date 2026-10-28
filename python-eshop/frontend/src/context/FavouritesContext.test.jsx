import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: { isAuthenticated: false, email: null } }));
const api = vi.hoisted(() => ({
  getFavourites: vi.fn(),
  addFavourite: vi.fn(),
  removeFavourite: vi.fn(),
}));

vi.mock('../api/client', () => ({ api }));
vi.mock('./AuthContext', () => ({ useAuth: () => auth.value }));

import { FavouritesProvider, useFavourites } from './FavouritesContext';

const SIGNED_IN = { isAuthenticated: true, email: 'demouser@perthai.com.au' };
const SIGNED_OUT = { isAuthenticated: false, email: null };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  return renderHook(() => useFavourites(), { wrapper: FavouritesProvider });
}

async function ready(result) {
  await waitFor(() => expect(result.current.status).toBe('ready'));
}

beforeEach(() => {
  auth.value = SIGNED_IN;
  api.getFavourites.mockResolvedValue([{ id: 2 }, { id: 5 }]);
  api.addFavourite.mockResolvedValue(null);
  api.removeFavourite.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FavouritesContext', () => {
  it('has no favourites and makes no request for an anonymous shopper', () => {
    auth.value = SIGNED_OUT;

    const { result } = setup();

    expect(result.current.isFavourite(2)).toBe(false);
    expect(api.getFavourites).not.toHaveBeenCalled();
  });

  it('fetches the favourites once after sign-in', async () => {
    const { result } = setup();
    expect(result.current.status).toBe('loading');

    await ready(result);

    expect(api.getFavourites).toHaveBeenCalledTimes(1);
    expect(result.current.isFavourite(2)).toBe(true);
    expect(result.current.isFavourite(5)).toBe(true);
    expect(result.current.isFavourite(3)).toBe(false);
  });

  it('shows a failed load as an error, not as an empty list', async () => {
    api.getFavourites.mockRejectedValue(new Error('boom'));

    const { result } = setup();

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.isFavourite(2)).toBe(false);
  });

  it('fills the heart immediately, before the request finishes', async () => {
    const request = deferred();
    api.addFavourite.mockReturnValue(request.promise);
    const { result } = setup();
    await ready(result);

    let toggled;
    act(() => {
      toggled = result.current.toggleFavourite(3);
    });

    expect(result.current.isFavourite(3)).toBe(true);

    await act(async () => {});
    expect(api.addFavourite).toHaveBeenCalledWith(3);
    expect(result.current.isFavourite(3)).toBe(true);

    await act(async () => {
      request.resolve(null);
      await toggled;
    });
    expect(result.current.isFavourite(3)).toBe(true);
  });

  it('removes a favourite when its heart is clicked while filled', async () => {
    const { result } = setup();
    await ready(result);

    await act(() => result.current.toggleFavourite(2));

    expect(api.removeFavourite).toHaveBeenCalledWith(2);
    expect(result.current.isFavourite(2)).toBe(false);
  });

  it('puts the heart back and reports the error when saving fails', async () => {
    api.addFavourite.mockRejectedValue(new Error('Server said no'));
    const { result } = setup();
    await ready(result);

    let failure;
    await act(async () => {
      failure = await result.current.toggleFavourite(3).catch((error) => error);
    });

    expect(failure.message).toBe('Server said no');
    expect(result.current.isFavourite(3)).toBe(false);
  });

  it('puts a removed heart back when removal fails', async () => {
    api.removeFavourite.mockRejectedValue(new Error('Server said no'));
    const { result } = setup();
    await ready(result);

    await act(async () => {
      await result.current.toggleFavourite(2).catch(() => {});
    });

    expect(result.current.isFavourite(2)).toBe(true);
  });

  it('ends in the state the shopper intended after a double click', async () => {
    const first = deferred();
    api.addFavourite.mockReturnValueOnce(first.promise);
    const { result } = setup();
    await ready(result);

    let both;
    act(() => {
      both = Promise.all([
        result.current.toggleFavourite(3),
        result.current.toggleFavourite(3),
      ]);
    });
    expect(result.current.isFavourite(3)).toBe(false);

    await act(async () => {
      first.resolve(null);
      await both;
    });

    expect(api.addFavourite).toHaveBeenCalledTimes(1);
    expect(api.removeFavourite).toHaveBeenCalledTimes(1);
    expect(api.addFavourite.mock.invocationCallOrder[0]).toBeLessThan(
      api.removeFavourite.mock.invocationCallOrder[0],
    );
    expect(result.current.isFavourite(3)).toBe(false);
  });

  it('keeps the intended state when an earlier click fails but a later one succeeds', async () => {
    const first = deferred();
    api.addFavourite.mockReturnValueOnce(first.promise);
    const { result } = setup();
    await ready(result);

    let both;
    act(() => {
      both = Promise.all([
        result.current.toggleFavourite(3).catch(() => {}),
        result.current.toggleFavourite(3),
      ]);
    });

    await act(async () => {
      first.reject(new Error('Server said no'));
      await both;
    });

    expect(result.current.isFavourite(3)).toBe(false);
  });

  it('clears every heart on sign-out', async () => {
    const { result, rerender } = setup();
    await ready(result);
    expect(result.current.isFavourite(2)).toBe(true);

    auth.value = SIGNED_OUT;
    rerender();

    await waitFor(() => expect(result.current.isFavourite(2)).toBe(false));
  });

  it('does not show the previous shopper hearts to the next shopper', async () => {
    const { result, rerender } = setup();
    await ready(result);

    auth.value = SIGNED_OUT;
    rerender();
    auth.value = { isAuthenticated: true, email: 'someone.else@example.com' };
    api.getFavourites.mockResolvedValue([{ id: 7 }]);
    rerender();

    await waitFor(() => expect(result.current.isFavourite(7)).toBe(true));
    expect(result.current.isFavourite(2)).toBe(false);
  });
});
