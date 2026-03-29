import React from 'react';

// Lightweight mock UI for Skills Taxonomy plugin (Android parity)
export default function SkillsTaxonomyMock() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Skills Taxonomy (Mock)</h2>
      <p>This is a mock UI for the Skills Taxonomy plugin. No backend required.</p>
      <ul>
        <li>Browse Sectors, Job Titles, Skills (mocked)</li>
        <li>Expand/collapse hierarchy (UI only)</li>
        <li>CRUD actions are non-functional</li>
        <li>Dependency-impact preview (static)</li>
      </ul>
      <div style={{ marginTop: 16, border: '1px solid #ccc', padding: 12 }}>
        <strong>Sector:</strong> Engineering
        <ul>
          <li>
            <strong>Job Title:</strong> Software Engineer
            <ul>
              <li>Skill: React</li>
              <li>Skill: TypeScript</li>
            </ul>
          </li>
          <li>
            <strong>Job Title:</strong> QA Engineer
            <ul>
              <li>Skill: Cypress</li>
              <li>Skill: Jest</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
}
