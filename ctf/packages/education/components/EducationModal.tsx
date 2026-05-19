import React, { useState } from 'react';
import { EducationContent } from '../schema';
import ReactMarkdown from 'react-markdown';

interface EducationModalProps {
  content: EducationContent;
  onSkip: () => void;
  onComplete: () => void;
  pluginName: string;
}

export const EducationModal: React.FC<EducationModalProps> = ({ content, onSkip, onComplete }) => {
  const [sectionIndex, setSectionIndex] = useState(0);
  const section = content.sections[sectionIndex];
  const isLast = sectionIndex === content.sections.length - 1;

  return (
    <div className="education-modal">
      <h2>{content.title}</h2>
      <div className="education-section">
        <h3>{section.title}</h3>
        <ReactMarkdown>{section.body}</ReactMarkdown>
        {section.mediaUrl && <img src={section.mediaUrl} alt="" />}
      </div>
      <div className="education-actions">
        <button onClick={onSkip}>Skip</button>
        {isLast ? (
          <button onClick={onComplete}>Finish</button>
        ) : (
          <button onClick={() => setSectionIndex(i => i + 1)}>Next</button>
        )}
      </div>
    </div>
  );
};
