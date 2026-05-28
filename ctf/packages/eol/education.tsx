import React, { useState } from 'react';
import { EducationModal } from '@ctf/education';
import { loadEducationContent } from '@ctf/education/content/loader';

export const EOLEducation: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [skipped, setSkipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const content = loadEducationContent('eol');

  if (skipped || completed) {
    onDone();
    return null;
  }

  return (
    <EducationModal
      content={content}
      onSkip={() => setSkipped(true)}
      onComplete={() => setCompleted(true)}
      pluginName="eol"
    />
  );
};
