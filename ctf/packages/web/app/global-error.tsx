'use client';

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';

type GlobalErrorProps = {
	error: Error & { digest?: string };
};

export default function GlobalError({ error }: GlobalErrorProps): React.JSX.Element {
	React.useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return React.createElement(
		'html',
		null,
		React.createElement('body', null, React.createElement(NextError, { statusCode: 0 }))
	);
}
