import { describe, test, expect } from 'vitest';
import { sanitizeInput, generateMockMealPlan, getFeasibilityColor } from './utils';

describe('Sanitize Input Helper', () => {
  test('strips HTML tags successfully', () => {
    const dirty = '<script>alert("hack")</script>Hello <b>World</b>';
    expect(sanitizeInput(dirty)).toBe('alert("hack")Hello World');
  });

  test('removes braces and brackets to prevent prompt injection', () => {
    const dirty = '{user: "admin", role: [1, 2]} \\test';
    expect(sanitizeInput(dirty)).toBe('user: "admin", role:  1, 2    test');
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

  test('returns default feasibility colors for unknown levels', () => {
    const colors = getFeasibilityColor('unknown');
    expect(colors.bg).toBe('#F3F4F6');
    expect(colors.text).toBe('#374151');
  });
});

describe('Mock Meal Plan Generator', () => {
  test('scales grocery quantities according to peopleCount', () => {
    const inputs = {
      peopleCount: 4,
      budget: 800,
      currency: 'INR',
      dietaryRestrictions: []
    };
    const plan = generateMockMealPlan(inputs);
    expect(plan.grocery_list).toHaveLength(5);
    expect(plan.grocery_list[0].quantity).toBe('4 pack(s)');
  });

  test('applies Vegetarian changes to breakfast and lunch', () => {
    const inputs = {
      peopleCount: 2,
      budget: 100,
      currency: 'USD',
      dietaryRestrictions: ['Vegetarian']
    };
    const plan = generateMockMealPlan(inputs);
    expect(plan.breakfast.name).toContain('Tofu Scramble');
    expect(plan.dinner.name).toContain('Paneer Butter Masala');
  });

  test('applies Vegan changes to breakfast and dinner', () => {
    const inputs = {
      peopleCount: 2,
      budget: 100,
      currency: 'USD',
      dietaryRestrictions: ['Vegan']
    };
    const plan = generateMockMealPlan(inputs);
    expect(plan.breakfast.name).toContain('Oatmeal');
    expect(plan.dinner.name).toContain('Coconut Lentil Curry');
  });

  test('evaluates feasibility levels correctly based on budget', () => {
    // High budget in INR (800 / 2 = 400 per person) -> High Feasibility
    const inputsHigh = {
      peopleCount: 2,
      budget: 1000,
      currency: 'INR',
      dietaryRestrictions: []
    };
    const planHigh = generateMockMealPlan(inputsHigh);
    expect(planHigh.budget_summary.feasibility).toBe('high');

    // Low budget in INR (200 / 2 = 100 per person) -> Low Feasibility
    const inputsLow = {
      peopleCount: 2,
      budget: 200,
      currency: 'INR',
      dietaryRestrictions: []
    };
    const planLow = generateMockMealPlan(inputsLow);
    expect(planLow.budget_summary.feasibility).toBe('low');
  });
});
