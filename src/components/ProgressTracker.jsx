import React from 'react';

export default function ProgressTracker({ currentStep }) {
  return (
    <div className="progress-container" aria-label="Progress Tracker">
      <div className="progress-line">
        <div 
          className="progress-line-fill" 
          style={{ width: `${(Math.min(currentStep, 3) - 1) * 50}%` }}
        ></div>
      </div>
      <div 
        className={`progress-step ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}`} 
        aria-current={currentStep === 1 ? 'step' : undefined}
      >
        {currentStep > 1 ? '✓' : '1'}
      </div>
      <div 
        className={`progress-step ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}`}
        aria-current={currentStep === 2 ? 'step' : undefined}
      >
        {currentStep > 2 ? '✓' : '2'}
      </div>
      <div 
        className={`progress-step ${currentStep === 3 ? 'active' : ''}`}
        aria-current={currentStep === 3 ? 'step' : undefined}
      >
        3
      </div>
    </div>
  );
}
