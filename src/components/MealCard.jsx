import React from 'react';

export default function MealCard({ type, meal, isExpanded, onToggle }) {
  const titleId = `${type.toLowerCase()}-title`;

  return (
    <article className="meal-card" aria-labelledby={titleId}>
      <div 
        className="meal-card-header"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
      >
        <span className="meal-badge">{type}</span>
        <h3 id={titleId} className="meal-title">{meal?.name || type}</h3>
        <div className="meal-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
          </svg>
          <span>Prep: {meal?.prep_time || 'N/A'}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>
            {isExpanded ? '− Hide steps' : '+ Show steps'}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="meal-card-body">
          <h4 className="meal-steps-title">Preparation Steps</h4>
          <ol className="meal-steps-list">
            {(meal?.steps || []).map((step, idx) => (
              <li key={idx} className="meal-step-item">
                <span className="meal-step-num">{idx + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
