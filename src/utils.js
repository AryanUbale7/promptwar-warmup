// Dietary restrictions list
export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher'
];

// Sanitize input helper
export const sanitizeInput = (text) => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>?/gm, '') // Strip HTML
    .replace(/[{}[\]\\]/g, ' ') // Strip raw brackets
    .replace(/"/g, '\\"') // Escape double quotes to prevent prompt injection
    .trim();
};

// Helper to generate dynamic mock data based on input parameters
export const generateMockMealPlan = (inputs) => {
  const isINR = inputs.currency === 'INR';
  const symbol = isINR ? '₹' : '$';
  const num = parseInt(inputs.peopleCount, 10) || 1;
  const restrictions = inputs.dietaryRestrictions || [];
  const budgetVal = parseFloat(inputs.budget) || 100;
  
  const isVeg = restrictions.includes('Vegetarian') || restrictions.includes('Vegan');
  const isVegan = restrictions.includes('Vegan');
  
  let breakfastName = "Avocado Toast with Poached Eggs";
  let breakfastPrep = "15 mins";
  let breakfastSteps = [
    "Toast the artisanal sourdough slices until golden brown.",
    "Mash fresh avocados with lime juice, salt, and red pepper flakes.",
    "Poach the eggs in simmering water with a splash of vinegar for 3 minutes.",
    "Spread avocado on toast, top with poached eggs, and garnish with microgreens."
  ];
  
  if (isVegan) {
    breakfastName = "Classic Oatmeal Bowl with Mixed Berries & Almonds";
    breakfastSteps = [
      "Simmer steel-cut oats in almond milk until creamy.",
      "Stir in chia seeds, maple syrup, and a pinch of cinnamon.",
      "Top with fresh blueberries, sliced strawberries, and toasted almonds."
    ];
  } else if (isVeg) {
    breakfastName = "Fluffy Tofu Scramble with Spinach & Cherry Tomatoes";
    breakfastSteps = [
      "Crumble firm tofu into a hot skillet with olive oil.",
      "Season with turmeric, nutritional yeast, garlic powder, and salt.",
      "Sauté with fresh baby spinach and halved cherry tomatoes until tender."
    ];
  }

  let lunchName = "Grilled Chicken & Quinoa Salad";
  let lunchPrep = "20 mins";
  let lunchSteps = [
    "Rinse and cook quinoa in vegetable broth.",
    "Season chicken breast with paprika, oregano, salt, and pepper, then grill.",
    "Chop cucumbers, cherry tomatoes, and olives.",
    "Toss everything together with olive oil and fresh lemon dressing."
  ];
  
  if (isVegan || isVeg) {
    lunchName = "Crispy Chickpea & Mediterranean Quinoa Bowl";
    lunchSteps = [
      "Roast canned chickpeas with olive oil, cumin, and paprika at 200°C for 20 mins.",
      "Cook quinoa in vegetable broth until fluffy.",
      "Combine in a bowl with diced cucumbers, cherry tomatoes, shredded carrots, and olives.",
      "Drizzle with a creamy tahini-lemon dressing."
    ];
  }

  let dinnerName = "Pan-Seared Salmon with Asparagus & Garlic Mashed Potatoes";
  let dinnerPrep = "30 mins";
  let dinnerSteps = [
    "Boil potatoes and mash with butter, milk, garlic, salt, and pepper.",
    "Season salmon fillets with lemon pepper and sear in a hot pan for 4 mins each side.",
    "Sauté asparagus spears in olive oil and minced garlic until tender-crisp.",
    "Plate the mashed potatoes, top with salmon, and serve with asparagus."
  ];
  
  if (isVegan) {
    dinnerName = "Creamy Coconut Lentil Curry with Jasmine Rice";
    dinnerSteps = [
      "Sauté diced onions, garlic, and minced ginger in coconut oil.",
      "Add red lentils, coconut milk, crushed tomatoes, and yellow curry powder.",
      "Simmer for 20 minutes until lentils are soft and curry is thickened.",
      "Serve hot over a bed of steamed jasmine rice, garnished with fresh cilantro."
    ];
  } else if (isVeg) {
    dinnerName = "Creamy Paneer Butter Masala with Garlic Naan";
    dinnerSteps = [
      "Sauté onion, garlic, ginger, and tomatoes, then blend into a smooth paste.",
      "Cook the paste in butter, adding garam masala, chili powder, and cream.",
      "Fold in cubed paneer and simmer for 5 minutes.",
      "Garnish with cilantro and serve with warm garlic naan."
    ];
  }

  // Scale grocery list based on people count
  const estimatedCost = budgetVal * 0.85; // 85% of budget
  
  const grocery_list = [
    { item: isVegan ? "Steel-cut oats" : (isVeg ? "Firm tofu" : "Sourdough bread"), quantity: `${num} pack(s)`, estimated_cost: `${symbol}${(estimatedCost * 0.2 / num).toFixed(2)}` },
    { item: isVegan ? "Almond milk" : (isVeg ? "Spinach" : "Eggs"), quantity: `${num} carton(s)`, estimated_cost: `${symbol}${(estimatedCost * 0.15 / num).toFixed(2)}` },
    { item: "Quinoa", quantity: `${(0.1 * num).toFixed(1)} kg`, estimated_cost: `${symbol}${(estimatedCost * 0.15 / num).toFixed(2)}` },
    { item: isVegan || isVeg ? "Chickpeas" : "Chicken breast", quantity: `${(0.2 * num).toFixed(1)} kg`, estimated_cost: `${symbol}${(estimatedCost * 0.25 / num).toFixed(2)}` },
    { item: isVegan ? "Red lentils" : (isVeg ? "Paneer" : "Salmon fillets"), quantity: `${(0.2 * num).toFixed(1)} kg`, estimated_cost: `${symbol}${(estimatedCost * 0.25 / num).toFixed(2)}` }
  ];

  const substitutions = [
    { original: "Almond milk", substitute: "Oat milk or soy milk", reason: "Nut-free alternative or creamier texture preference." },
    { original: isVegan || isVeg ? "Naan" : "Chicken", substitute: isVegan || isVeg ? "Gluten-free flatbread" : "Firm Tofu", reason: "Dietary restrictions or allergen avoidance." }
  ];

  // Feasibility calculation
  let feasibility = "high";
  let tips = [
    "Buy dry goods like quinoa, oats, and lentils in bulk to save costs.",
    "Prep ingredients like chopped veggies and cooked grains over the weekend to save prep time.",
    "Store leftovers in airtight containers to keep them fresh for up to 3 days."
  ];

  const budgetPerPerson = budgetVal / num;
  const thresholdLow = isINR ? 150 : 6;
  const thresholdMedium = isINR ? 400 : 15;

  if (budgetPerPerson < thresholdLow) {
    feasibility = "low";
    tips.push("The budget is very tight for the number of people. Focus on basic staples like rice, lentils, and potatoes, and reduce protein portions.");
  } else if (budgetPerPerson < thresholdMedium) {
    feasibility = "medium";
    tips.push("Budget is reasonable. Consider swapping organic or premium cuts for standard options, and look for store-brand labels.");
  } else {
    feasibility = "high";
    tips.push("Excellent budget allocation. You have room for premium ingredients, fresh organic produce, and high-quality proteins.");
  }

  return {
    breakfast: { name: breakfastName, prep_time: breakfastPrep, steps: breakfastSteps },
    lunch: { name: lunchName, prep_time: lunchPrep, steps: lunchSteps },
    dinner: { name: dinnerName, prep_time: dinnerPrep, steps: dinnerSteps },
    grocery_list,
    substitutions,
    budget_summary: {
      total_estimated: `${symbol}${estimatedCost.toFixed(2)}`,
      feasibility,
      tips
    }
  };
};

// Return feasibility color class
export const getFeasibilityColor = (level) => {
  switch (String(level).toLowerCase()) {
    case 'high':
      return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', dot: '#34D399' };
    case 'medium':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', dot: '#FBBF24' };
    case 'low':
      return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', dot: '#F87171' };
    default:
      return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', dot: '#9CA3AF' };
  }
};
