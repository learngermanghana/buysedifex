'use client';

import { FormEvent, useState } from 'react';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type ConcernFormState = {
  name: string;
  contact: string;
  concernType: string;
  details: string;
};

const initialFormState: ConcernFormState = {
  name: '',
  contact: '',
  concernType: 'trust-safety',
  details: '',
};

export function ConcernReportForm() {
  const [formState, setFormState] = useState<ConcernFormState>(initialFormState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState('submitting');

    try {
      const response = await fetch('/api/concerns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name.trim(),
          contact: formState.contact.trim(),
          concernType: formState.concernType,
          details: formState.details.trim(),
          pagePath: window.location.pathname,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit concern');
      }

      setFormState(initialFormState);
      setSubmitState('success');
    } catch (error) {
      console.error(error);
      setSubmitState('error');
    }
  };

  return (
    <form className="requestForm" onSubmit={onSubmit}>
      <h3>Report a concern</h3>
      <label htmlFor="concern-name">Name</label>
      <input
        id="concern-name"
        name="name"
        type="text"
        required
        value={formState.name}
        onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
      />

      <label htmlFor="concern-contact">Phone or email</label>
      <input
        id="concern-contact"
        name="contact"
        type="text"
        required
        value={formState.contact}
        onChange={(event) => setFormState((current) => ({ ...current, contact: event.target.value }))}
      />

      <label htmlFor="concern-type">Concern type</label>
      <select
        id="concern-type"
        name="concernType"
        value={formState.concernType}
        onChange={(event) => setFormState((current) => ({ ...current, concernType: event.target.value }))}
      >
        <option value="trust-safety">Trust & safety</option>
        <option value="fraud">Fraud / scam risk</option>
        <option value="product-quality">Product quality</option>
        <option value="other">Other</option>
      </select>

      <label htmlFor="concern-details">Details</label>
      <textarea
        id="concern-details"
        name="details"
        rows={4}
        required
        value={formState.details}
        onChange={(event) => setFormState((current) => ({ ...current, details: event.target.value }))}
      />

      <button className="requestButton" type="submit" disabled={submitState === 'submitting'}>
        {submitState === 'submitting' ? 'Submitting concern...' : 'Submit concern'}
      </button>

      {submitState === 'success' ? <p className="requestFeedback success">Concern submitted successfully.</p> : null}
      {submitState === 'error' ? <p className="requestFeedback error">Unable to submit concern. Try again.</p> : null}
    </form>
  );
}
