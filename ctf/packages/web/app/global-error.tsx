'use client';

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
import { PageErrorNotice } from '@/components/shared/page-error-notice';

type GlobalErrorProps = {
	error: Error & { digest?: string };
};

// Only reached when the root layout itself fails; app/error.tsx handles a page failure inside the
// layout. Replaces Next's built-in notice, which says "a client-side exception has occurred" for a
// server failure too and points a phone user at a browser log they cannot open.
export default function GlobalError({ error }: GlobalErrorProps): React.JSX.Element {
	React.useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="en">
			<body style={{ margin: 0 }}>
				<PageErrorNotice digest={error.digest} />
			</body>
		</html>
	);
}
