# 🍽️ Curated Meal Planner

An AI-powered, guided step-by-step meal planner application built with **React, Vite, and Vanilla CSS**. The application helps users plan their breakfast, lunch, and dinner based on daily schedules, budget caps, cooking count, and dietary restrictions, featuring live integrations with **Anthropic's Claude** and **Google AI Studio's Gemini**.

---

## 🌟 Key Features

### 1. Guided Step-by-Step Flow
* **Step 1: Describe Your Day:** Provide details about your schedule, events, cooking count (clamped between 1-20), and cooking skill level (Beginner, Intermediate, Advanced).
* **Step 2: Budget & Preferences:** Enter your daily food budget with a live currency toggle (₹/INR or $/USD), dietary restriction chips (Vegetarian, Vegan, Gluten-Free, etc.), and ingredients you already have.
* **Step 3: Meal Plan Results:** View cards for Breakfast, Lunch, and Dinner with expandable preparation steps, a dynamically scaled grocery table, smart ingredient substitutions, and a budget feasibility badge.

### 2. Multi-Mode API Integrations
* **Google AI Studio (Gemini 1.5 Flash):** Default live demo API integration. Pre-load your API key using `.env.local` to trigger live AI generation with built-in JSON structured parsing.
* **Anthropic API (Claude 3.5 Sonnet):** Call the Anthropic Messages API directly using your personal key configured via the live settings banner.
* **Offline Mock Mode:** Generate realistic, dynamically scaled plans locally without making external network calls.

### 3. Built-In Accessibility (A11y)
* Semantic HTML5 layout (`<main>`, `<section>`, `<article>`, `<header>`).
* Associated `<label>` linkages and inline validation alerts (`aria-describedby`).
* Keyboard-navigable multi-select dietary chips (ArrowLeft/ArrowRight to move focus, Space/Enter to toggle).
* Active focus shifting to step headings on transitions.
* `aria-live="polite"` and `aria-busy` states for loading overlay screen readers.

### 4. Code Quality & Testing
* **Vitest Suite:** Implemented unit tests covering input sanitization, mock generation logic, budget calculations, and feasibility color mappings.
* **Modularity:** Isolated business logic and helpers into `src/utils.js` for clear separation of concerns.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/AryanUbale7/promptwar-warmup.git
   cd promptwar-warmup
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   Create a `.env.local` file in the root directory and add your Google AI Studio API Key (this file is ignored by Git):
   ```env
   VITE_GOOGLE_API_KEY=your_google_ai_studio_api_key_here
   ```

4. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## 🧪 Running Tests

Verify the business logic and sanitization helpers using Vitest:
```bash
npm run test
```

---

## 📦 Production Build

Compile the application into static files for production deployment:
```bash
npm run build
```
Vite will compile the code and styles into the `dist/` directory.

---

## 🌐 Netlify Deployment Guide

To host this application on Netlify:

1. Connect your GitHub repository to **Netlify**.
2. Set the build configurations:
   * **Build command:** `npm run build`
   * **Publish directory:** `dist`
3. Configure the environment variables:
   * Go to **Site Configuration** > **Environment variables**.
   * Click **Add a variable** > **Add a single variable**.
   * **Key:** `VITE_GOOGLE_API_KEY`
   * **Value:** `your_api_key`
4. Trigger a deploy.

> [!CAUTION]
> Because this is a static client-side application, environment variables prefixed with `VITE_` are bundled into the public Javascript bundle at build time and can be extracted by users. For production keys, it is recommended to let users enter their own keys in the settings input box.
