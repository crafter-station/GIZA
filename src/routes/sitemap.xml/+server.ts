import { siteUrl } from '#lib/app/site.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${siteUrl('/')}</loc>
	</url>
</urlset>
`;

export const GET: RequestHandler = () =>
	new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
