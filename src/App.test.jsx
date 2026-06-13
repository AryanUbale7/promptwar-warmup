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

  test('Validation: submit with day description < 20 characters expect inline error, no API call', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<App />);

    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Too short' } });

    const nextBtn = screen.getByRole('button', { name: /Proceed to step 2/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Describe your day in at least 20 characters/i)).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('Validation: submit with people count = 0 expect clamped to 1 or inline error', async () => {
    render(<App />);

    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });

    const countInput = screen.getByLabelText(/How many people are you cooking for\?/i);
    fireEvent.change(countInput, { target: { value: '0' } });
    expect(countInput.value).toBe('1'); // clamped to 1
  });

  test('Validation: submit with budget = -50 expect clamped to 1 or inline error', async () => {
    render(<App />);

    // Step 1
    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });
    fireEvent.click(screen.getByRole('button', { name: /Proceed to step 2/i }));

    // Step 2 - Input budget -50
    const budgetInput = screen.getByLabelText(/Daily food budget\?/i);
    fireEvent.change(budgetInput, { target: { value: '-50' } });

    // Click Generate
    const generateBtn = screen.getByRole('button', { name: /Generate meal plan/i });
    fireEvent.click(generateBtn);

    // expect inline error because budget is <= 0
    expect(screen.getByText(/Please enter a valid daily budget greater than 0/i)).toBeDefined();
  });

  test('API error handling: mock fetch to reject expect ERR_NETWORK message to appear in DOM', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    render(<App />);

    // Disable Demo Mode to trigger live API call
    const modeToggle = screen.getByLabelText(/API Integration Mode/i).querySelector('input');
    if (modeToggle) {
      fireEvent.click(modeToggle);
    }

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

    // Verify error is shown in DOM with ERR_NETWORK classification
    await waitFor(() => {
      expect(screen.getByText(/Connection failed. Check your internet and try again./i)).toBeDefined();
    });

    global.fetch = originalFetch;
  });

  test('Schema validation: mock API to return JSON missing the dinner key expect ERR_SCHEMA message to appear, no crash', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        breakfast: { name: 'Toast', prep_time: '5 mins', steps: ['Toast it'] },
        lunch: { name: 'Salad', prep_time: '10 mins', steps: ['Mix it'] },
        // dinner is missing
        grocery_list: [],
        substitutions: [],
        budget_summary: { total_estimated: '$10', feasibility: 'high', tips: [] }
      })
    });

    render(<App />);

    const modeToggle = screen.getByLabelText(/API Integration Mode/i).querySelector('input');
    if (modeToggle) {
      fireEvent.click(modeToggle);
    }

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

    // Verify error is shown in DOM with ERR_SCHEMA classification
    await waitFor(() => {
      expect(screen.getByText(/The meal plan was incomplete. Please regenerate./i)).toBeDefined();
    });

    global.fetch = originalFetch;
  });

  test('sessionStorage: after form fill, simulate beforeunload expect storage keys to be cleared', async () => {
    render(<App />);

    const textarea = screen.getByLabelText(/What does your day look like\?/i);
    fireEvent.change(textarea, { target: { value: 'Working hard all day in the office and need healthy dinners' } });

    // Storage keys should be set in sessionStorage
    expect(sessionStorage.getItem('mealplanner_v1_day_desc')).toBe('Working hard all day in the office and need healthy dinners');

    // Trigger beforeunload event on window
    window.dispatchEvent(new Event('beforeunload'));

    // Storage keys should be removed
    expect(sessionStorage.getItem('mealplanner_v1_day_desc')).toBeNull();
  });
});
