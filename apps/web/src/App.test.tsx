import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.js';

const itemFixture = {
  id: 'itm_1',
  title: 'Probar el scaffold',
  done: false,
  createdAt: '2026-08-14T12:40:00.000Z',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('muestra los items que devuelve el API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([itemFixture]));

    render(<App />);

    expect(await screen.findByText('Probar el scaffold')).toBeInTheDocument();
  });

  it('muestra el estado vacio cuando no hay items', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(await screen.findByText('Todavia no hay items.')).toBeInTheDocument();
  });

  it('crea un item y lo agrega a la lista', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(itemFixture, 201));

    render(<App />);
    await screen.findByText('Todavia no hay items.');

    await userEvent.type(screen.getByLabelText('Titulo del item'), 'Probar el scaffold');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Probar el scaffold')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('muestra el error que devuelve el API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Error interno del servidor' } }, 500),
    );

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor');
  });
});
