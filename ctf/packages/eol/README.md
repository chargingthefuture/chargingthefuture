# EOL Plugin

This plugin provides end-of-life planning tools for users, with a trauma-informed, privacy-first approach.

## Educational Component
- Integrates the shared `EducationModal` from `@ctf/education`.
- Loads content from `education/content/eol.md`.
- Educational content is always optional/skippable.

## Example Usage
```tsx
import React, { useState } from 'react';
import { EOLEducation } from './education';

export const EOLPlugin: React.FC = () => {
  const [educationDone, setEducationDone] = useState(false);
  if (!educationDone) {
    return <EOLEducation onDone={() => setEducationDone(true)} />;
  }
  // ...main plugin UI
};
```

## Compliance
- Follows CTF monorepo modularity, typecheck, and trauma-informed design rules.

---
For more, see the main monorepo documentation.
