'use client';

import * as React from 'react';
import { reportError } from '@/lib/observability/report';
import { PageErrorNotice } from '@/components/shared/page-error-notice';

type PageErrorProps = {
  error: Error & { digest?: string };
};

// A page that throws while rendering lands here, inside the root layout, so the theme and phone frame
// stay. The digest shown is the same reference the server logged for the failure.
export default function PageError({ error }: PageErrorProps): React.JSX.Element {
  React.useEffect(() => {
    reportError(error, { area: 'web-pages', op: 'page_render', extra: { digest: error.digest ?? null } });
  }, [error]);

  return <PageErrorNotice digest={error.digest} />;
}
