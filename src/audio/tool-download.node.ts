import { createDownload, type transcribe } from 'ai';
import { createGuardedFetch } from 'guarded-fetch';

/** Keep SDK URL and redirect checks and validate the address used to connect. */
export const downloadToolAudio: NonNullable<Parameters<typeof transcribe>[0]['download']> = async request => {
	const transport = createGuardedFetch();
	try { return await createDownload({ fetch: transport })(request); }
	finally { await transport.close(); }
};
