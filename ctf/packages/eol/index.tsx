

import React, { useState } from 'react';
import { EOLEducation } from './education';
import { WillWizard } from './will-wizard';

export const EOLPlugin: React.FC = () => {
  const [educationDone, setEducationDone] = useState(false);
  const [willComplete, setWillComplete] = useState(false);
  const [willData, setWillData] = useState<any>(null);

  if (!educationDone) {
    return <EOLEducation onDone={() => setEducationDone(true)} />;
  }

  if (!willComplete) {
    return (
      <div>
        <h2>Basic Will & Testament Builder</h2>
        <p>See <a href="./legal-disclaimers.md" target="_blank" rel="noopener noreferrer">Legal Disclaimers</a> before proceeding.</p>
        <WillWizard onComplete={(data) => { setWillData(data); setWillComplete(true); }} />
      </div>
    );
  }

  // Review and export/print. Document persistence was removed with Supabase and
  // is not yet replaced — the will is local-only (print/export) for now.
  return (
    <div>
      <h2>Your Will Summary</h2>
      <pre>{JSON.stringify(willData, null, 2)}</pre>
      <p>
        <strong>To make this will legally binding:</strong>
        <ul>
          <li>Print this summary and sign it in the presence of required witnesses (see local laws).</li>
          <li>Consider having it notarized for extra validity.</li>
          <li>Store it in a safe place and inform your executor.</li>
        </ul>
      </p>
      <button onClick={() => window.print()}>Print</button>
    </div>
  );
};
