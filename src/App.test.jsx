import React from 'react';
import { describe, test, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sanitizeInput, generateMockMealPlan, getFeasibilityColor } from './utils';
import App from './App';

// Setup Mock for clipboard and fetch APIs in jsdom
beforeAll(() => {
  if (!navigator.clipboard) {
    navigator.clipboard = {
      writeText: () => Promise.resolve()
    };
  }

  // Mock global fetch to handle relative endpoint calls during tests
  global.fetch = vi.fn((url, options) => {
    if (String(url).includes('/api/generate')) {
      try {
        const body = JSON.parse(options.body);
        const mockPlan = generateMockMealPlan(body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPlan)
        });
      } catch (e) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Failed to compile request' })
        });
      }
    }
    return Promise.reject(new Error(`Fetch not mocked for URL: ${url}`));
  });
});

describe('Sanitize Input Helper', () => {
  test('strips HTML tags successfully', () => {
    const dirty = '<script>alert("hack")</script>Hello <b>World</b>';
    expect(sanitizeInput(dirty)).toBe('alert(\\"hack\\")Hello World');
  });

  test('removes braces and brackets and escapes quotes to prevent prompt injection', () => {
    const dirty = '{user: "admin", role: [1, 2]} \\test';
    expect(sanitizeInput(dirty)).toBe('user: \\"admin\\", role:  1, 2    test');
  });

  test('trims leading and trailing whitespace', () => {
    const dirty = '   clean me   ';
    expect(sanitizeInput(dirty)).toBe('clean me');
  });
});

describe('Feasibility Color Map', () => {
  test('returns high feasibility color palette', () => {
    const colors = getFeasibilityColor('high');
    expect(colors.bg).toBe('#D1FAE5');
    expect(colors.text).toBe('#065F46');
    expect(colors.dot).toBe('#34D399');
  });

  test('returns medium feasibility color palette', () => {
    const colors = getFeasibilityColor('medium');
    expect(colors.bg).toBe('#FEF3C7');
    expect(colors.text).toBe('#92400E');
    expect(colors.dot).toBe('#FBBF24');
  });

  test('returns low feasibility color palette', () => {
    const colors = getFeasibilityColor('low');
    expect(colors.bg).toBe('#FEE2E2');
    expect(colors.text).toBe('#991B1B');
    expect(colors.dot).toBe('#F87171');
  });
});

describe('React UI - Wizard Navigation & Validation', () => {
  test('renders step 1 details on initial load', () => {
    render(<App />);
    expect(screen.getByText('Step 1: Describe Your Day')).toBeDefined();
    expect(screen.getByLabelText(/What does your day look like\?/i)).toBeDefined();
    expect(screen.getByLabelText(/How many people are you cooking for\?/i)).toBeDefined();
  });

  test('shows validation errors when fields are empty and Next is clicked', async () => {
    render(<App />);
    
    const nextBtn = screen.getByRole('button', { name: /Proceed to step 2/i });
    fireEvent.click(nextBtn);

    // Errors should be shown because touched states are activated
    expect(screen.getByText(/Describe your day in at least 20 characters/i)).toBeDefined();
  });

  test('navigates to Step 2 when input is valid', async () => {
    render(<App />);
    
    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });
    
    const nextBtn = screen.getByRole('button', { name: /Proceed to step 2/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Step 2: Budget & Preferences')).toBeDefined();
  });

  test('shows budget validation errors in Step 2 when budget is invalid', async () => {
    render(<App />);
    
    // Fill Step 1
    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });
    fireEvent.click(screen.getByRole('button', { name: /Proceed to step 2/i }));

    // budget input starts empty
    const generateBtn = screen.getByRole('button', { name: /Generate meal plan/i });
    fireEvent.click(generateBtn);

    // Check for budget error
    expect(screen.getByText(/Please enter a valid daily budget greater than 0/i)).toBeDefined();
  });

  test('transitions to Step 3 loading state and then renders mock results', async () => {
    render(<App />);
    
    // Step 1
    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });
    fireEvent.click(screen.getByRole('button', { name: /Proceed to step 2/i }));

    // Step 2 - Input budget
    const budgetInput = screen.getByLabelText(/Daily food budget\?/i);
    fireEvent.change(budgetInput, { target: { value: '500' } });

    // Click Generate
    const generateBtn = screen.getByRole('button', { name: /Generate meal plan/i });
    fireEvent.click(generateBtn);

    // Verify loading state is shown
    expect(screen.getByText(/Planning your meals/i)).toBeDefined();

    // Wait for results to render (mocked fetch resolves immediately, but ResultsView handles state transition)
    await waitFor(() => {
      expect(screen.getByText('Your Customized Daily Meal Plan')).toBeDefined();
    }, { timeout: 3000 });

    // Expandable meal cards check
    expect(screen.getByText('Breakfast')).toBeDefined();
    expect(screen.getByText('Lunch')).toBeDefined();
    expect(screen.getByText('Dinner')).toBeDefined();
  });
});
