import { useCallback, useEffect, useState } from 'react';
import type { Item } from '@equipo17/shared';
import { itemsApi } from './lib/items.js';

/**
 * Pantalla de ejemplo que ejercita el CRUD completo contra el API.
 * Es la plantilla a reemplazar por la UI real del proyecto.
 */
export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await itemsApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      const created = await itemsApi.create({ title });
      setItems((prev) => [created, ...prev]);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    }
  };

  const handleToggle = async (item: Item) => {
    const updated = await itemsApi.toggle(item.id, !item.done);
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const handleRemove = async (id: string) => {
    await itemsApi.remove(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-brand-dark">Equipo 17 · HaCAIthon 2026</p>
        <h1 className="text-3xl font-bold tracking-tight">Items</h1>
        <p className="mt-1 text-sm text-gray-500">
          CRUD de ejemplo conectado a Express + Prisma. Reemplazalo por el dominio real.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          aria-label="Titulo del item"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nuevo item..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-black transition hover:bg-brand-dark disabled:opacity-50"
          disabled={!title.trim()}
        >
          Agregar
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Todavia no hay items.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => void handleToggle(item)}
                aria-label={`Marcar ${item.title}`}
                className="size-4 accent-brand"
              />
              <span className={item.done ? 'flex-1 text-gray-400 line-through' : 'flex-1'}>
                {item.title}
              </span>
              <button
                onClick={() => void handleRemove(item.id)}
                aria-label={`Eliminar ${item.title}`}
                className="text-sm text-gray-400 transition hover:text-red-600"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
