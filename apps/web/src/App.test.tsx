import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the Fluence title and the four M0 smoke cards', () => {
    render(<App />);
    expect(screen.getByTestId('app-title').textContent).toMatch(/Fluence/i);
    expect(screen.getByTestId('run-device')).toBeTruthy();
    expect(screen.getByTestId('run-storage')).toBeTruthy();
    expect(screen.getByTestId('run-geometry')).toBeTruthy();
    expect(screen.getByTestId('persist-status')).toBeTruthy();
  });
});
