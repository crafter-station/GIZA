export const SITE_NAME = 'Giza';
export const SITE_ORIGIN = 'https://giza.crafter.run';
export const SITE_TITLE = 'Pyramids of Giza in 3D: Deconstruct Khufu, Block by Block';
export const SITE_DESCRIPTION =
	'Fly through the pyramids of Giza in 3D and take Khufu apart block by block: 201 measured courses, its chambers, ramp hypotheses and the sky of 2560 BCE.';
export const SITE_LOCALE = 'en_US';
export const OG_IMAGE_PATH = '/metadata/og.jpg';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = 'The three pyramids of Giza at sunrise, seen from the western dunes';

export function siteUrl(path = '/'): string {
	return SITE_ORIGIN.length > 0 ? new URL(path, SITE_ORIGIN).href : path;
}

export function createStructuredData() {
	const url = siteUrl('/');
	const identity = SITE_ORIGIN.length > 0 ? { '@id': `${url}#website`, url } : {};
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				name: SITE_NAME,
				description: SITE_DESCRIPTION,
				inLanguage: 'en',
				...identity
			},
			{
				'@type': 'LearningResource',
				name: SITE_TITLE,
				description: SITE_DESCRIPTION,
				learningResourceType: 'Interactive 3D tour',
				educationalLevel: 'General public',
				inLanguage: 'en',
				isAccessibleForFree: true,
				about: {
					'@type': 'Place',
					name: 'Giza pyramid complex',
					containedInPlace: { '@type': 'Place', name: 'Giza, Egypt' }
				},
				...(SITE_ORIGIN.length > 0 ? { url } : {})
			}
		]
	};
}
