import React from 'react';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

// Delegates to the universal LoadingScreen so the "Exit Their Economy / Exit The
// Psyop" loading state is identical everywhere in the app.
export const TrustTransportLoadingState: React.FC = () => <LoadingScreen />;
