import { createHttpClient } from "@ctf/shared";

const mobileApiBaseUrl = process.env.EXPO_PUBLIC_APP_URL ?? "";

if (!mobileApiBaseUrl) {
	console.warn("EXPO_PUBLIC_APP_URL is not set. API calls will fail. Set it to your backend URL (e.g. http://<your-ip>:3000) for Expo Go testing.");
}

export const mobileApiClient = createHttpClient({ baseUrl: mobileApiBaseUrl });
