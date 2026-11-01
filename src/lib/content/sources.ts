export interface Source {
	author: string;
	title: string;
	year: number;
	publisher?: string;
	doi?: string;
	url?: string;
}

export const SOURCES = {
	lehner1997: {
		author: 'Mark Lehner',
		title: 'The Complete Pyramids',
		year: 1997,
		publisher: 'Thames & Hudson'
	},
	lehnerHawass2017: {
		author: 'Mark Lehner, Zahi Hawass',
		title: 'Giza and the Pyramids: The Definitive History',
		year: 2017,
		publisher: 'University of Chicago Press / Thames & Hudson'
	},
	verner2001: {
		author: 'Miroslav Verner',
		title: 'The Pyramids: The Mystery, Culture, and Science of Egypt’s Great Monuments',
		year: 2001,
		publisher: 'Grove Press'
	},
	petrie1883: {
		author: 'W. M. Flinders Petrie',
		title: 'The Pyramids and Temples of Gizeh',
		year: 1883,
		publisher: 'Field & Tuer'
	},
	romer2007: {
		author: 'John Romer',
		title: 'The Great Pyramid: Ancient Egypt Revisited',
		year: 2007,
		publisher: 'Cambridge University Press'
	},
	ramsey2010: {
		author: 'Christopher Bronk Ramsey et al.',
		title: 'Radiocarbon-Based Chronology for Dynastic Egypt',
		year: 2010,
		publisher: 'Science 328 (5985): 1554–1557',
		doi: '10.1126/science.1189395'
	},
	morishima2017: {
		author: 'Kunihiro Morishima et al.',
		title: 'Discovery of a big void in Khufu’s Pyramid by observation of cosmic-ray muons',
		year: 2017,
		publisher: 'Nature 552: 386–390',
		doi: '10.1038/nature24647'
	},
	procureur2023: {
		author: 'Sébastien Procureur et al.',
		title:
			'Precise characterization of a corridor-shaped structure in Khufu’s Pyramid by observation of cosmic-ray muons',
		year: 2023,
		publisher: 'Nature Communications 14: 1144',
		doi: '10.1038/s41467-023-36351-0'
	},
	tallet2017: {
		author: 'Pierre Tallet',
		title: 'Les papyrus de la mer Rouge I: Le « journal de Merer » (papyrus Jarf A et B)',
		year: 2017,
		publisher: 'Institut français d’archéologie orientale'
	},
	aeraLostCity: {
		author: 'Ancient Egypt Research Associates (AERA)',
		title: 'The Lost City of the Pyramids (Heit el-Ghurab)',
		year: 2024,
		url: 'https://www.aeraweb.org/lost-city/'
	},
	novaBuilders: {
		author: 'PBS NOVA (interviews with Mark Lehner and Zahi Hawass)',
		title: 'Who Built the Pyramids?',
		year: 1997,
		url: 'https://www.pbs.org/wgbh/nova/article/who-built-the-pyramids/'
	},
	wikipediaGiza: {
		author: 'Wikipedia contributors',
		title:
			'Great Pyramid of Giza; Pyramid of Khafre; Pyramid of Menkaure; Great Sphinx of Giza (infobox coordinates and cited figures)',
		year: 2026,
		url: 'https://en.wikipedia.org/wiki/Giza_pyramid_complex'
	},
	copernicusDem: {
		author: 'European Space Agency, Airbus',
		title: 'Copernicus DEM GLO-30 (tile N29 E031)',
		year: 2021,
		url: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM'
	}
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export type FactStatus = 'established' | 'estimate' | 'hypothesis';

export interface Fact<T = number> {
	value: T;
	unit?: string;
	status: FactStatus;
	sources: readonly SourceId[];
	checked: 'primary' | 'secondary' | 'computed';
	note?: string;
}

export function fact<T>(value: T, init: Omit<Fact<T>, 'value'>): Fact<T> {
	if (init.sources.length === 0) throw new Error('A fact needs at least one source.');
	return { value, ...init };
}
