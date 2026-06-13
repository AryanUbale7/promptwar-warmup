import React from 'react';

const GRAY_500 = '#6B7280';

export default function Step1({
  dayDescription,
  setDayDescription,
  peopleCount,
  setPeopleCount,
  skillLevel,
  setSkillLevel,
  validationErrors,
  touched,
  setTouched
}) {
  const showDescError = touched.dayDescription && validationErrors.dayDescription;
  const showPeopleError = touched.peopleCount && validationErrors.peopleCount;

  return (
    <section aria-labelledby="step-1-title">
      <h2 
        id="step-1-title" 
        className="step-title" 
        tabIndex="-1" 
      >
        Step 1: Describe Your Day
      </h2>
      
      <div className="form-grid two-cols">
        <div className="form-group col-span-full">
          <label htmlFor="day-desc-input" className="form-label">
            What does your day look like? *
          </label>
          <textarea
            id="day-desc-input"
            className="form-control"
            placeholder="Examples: Busy workday with back-to-back meetings, light dinner, need high energy meals; or relaxed weekend with a long family lunch..."
            value={dayDescription}
            onChange={(e) => {
              setDayDescription(e.target.value);
              setTouched(prev => ({ ...prev, dayDescription: true }));
            }}
            onBlur={() => setTouched(prev => ({ ...prev, dayDescription: true }))}
            aria-describedby={showDescError ? "desc-error desc-hint" : "desc-hint"}
            required
          />
          <span id="desc-hint" style={{ fontSize: '0.75rem', color: GRAY_500 }}>
            Enter at least 20 characters describing your scheduled events, energy levels, or constraints. ({dayDescription.length}/20)
          </span>
          {showDescError && (
            <span className="error-message" id="desc-error" role="alert">
              {validationErrors.dayDescription}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="people-count-input" className="form-label">
            How many people are you cooking for? *
          </label>
          <input
            id="people-count-input"
            type="number"
            min="1"
            max="20"
            className="form-control"
            value={peopleCount}
            onChange={(e) => {
              setPeopleCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)));
              setTouched(prev => ({ ...prev, peopleCount: true }));
            }}
            onBlur={() => setTouched(prev => ({ ...prev, peopleCount: true }))}
            aria-describedby={showPeopleError ? "people-error" : undefined}
            required
          />
          {showPeopleError && (
            <span className="error-message" id="people-error" role="alert">
              {validationErrors.peopleCount}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="skill-level-select" className="form-label">
            What's your cooking skill level?
          </label>
          <select
            id="skill-level-select"
            className="form-control"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
          >
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>
    </section>
  );
}
