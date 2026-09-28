// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('bad row');
}

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('renders a recovery screen instead of blanking the app, with a way to save data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', { name: /something went wrong/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /export my data/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /go to today/i })).toBeTruthy();
    spy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });
});
