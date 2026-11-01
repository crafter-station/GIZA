export interface GisFootprint {
	x: number;
	z: number;
	width: number;
	depth: number;
}

export interface GisMastaba extends GisFootprint {
	name: string | null;
	period: string | null;
	rotation: number;
}

export const GIS_PYRAMID_CENTERS: Record<string, GisFootprint> = {
	khufu: {
		x: 0.6,
		z: -5.77,
		width: 242.12,
		depth: 245.99
	},
	khafre: {
		x: -336.45,
		z: 357.58,
		width: 219.59,
		depth: 230.14
	},
	menkaure: {
		x: -565.56,
		z: 739.46,
		width: 102.55,
		depth: 108.74
	},
	g1a: {
		x: 203.08,
		z: 32.77,
		width: 49.2,
		depth: 50.07
	},
	g1b: {
		x: 202.07,
		z: 90.38,
		width: 49.87,
		depth: 49.63
	},
	g1c: {
		x: 200.28,
		z: 142.68,
		width: 47.52,
		depth: 47.48
	},
	g3a: {
		x: -559.05,
		z: 839.52,
		width: 34.52,
		depth: 35.61
	},
	g3b: {
		x: -602.78,
		z: 840.43,
		width: 34.66,
		depth: 33.07
	},
	g3c: {
		x: -646.72,
		z: 839.43,
		width: 32.53,
		depth: 31.47
	}
};

export const GIS_MASTABAS: readonly GisMastaba[] = [
	{
		name: '7110 7120',
		period: 'KHUFU',
		x: 253.58,
		z: 50.96,
		width: 18.8,
		depth: 84.13,
		rotation: -0.013
	},
	{
		name: null,
		period: null,
		x: 277.1,
		z: 50.75,
		width: 20.08,
		depth: 83.84,
		rotation: -0.0136
	},
	{
		name: null,
		period: null,
		x: 300.9,
		z: 50.93,
		width: 19.28,
		depth: 83.59,
		rotation: -0.0115
	},
	{
		name: '7110',
		period: 'KHUFU',
		x: 324.3,
		z: 51.8,
		width: 22.15,
		depth: 84.75,
		rotation: 3.1357
	},
	{
		name: null,
		period: null,
		x: 252.81,
		z: 132.48,
		width: 19.37,
		depth: 69.54,
		rotation: 3.1285
	},
	{
		name: null,
		period: null,
		x: 276.31,
		z: 132.3,
		width: 18.92,
		depth: 69.63,
		rotation: 3.1271
	},
	{
		name: null,
		period: null,
		x: 299.12,
		z: 132.15,
		width: 16.3,
		depth: 69.06,
		rotation: 3.1302
	},
	{
		name: null,
		period: null,
		x: 322.06,
		z: 132.68,
		width: 18.12,
		depth: 69.46,
		rotation: 3.1178
	},
	{
		name: ' ',
		period: null,
		x: 412.26,
		z: 125.29,
		width: 9.92,
		depth: 14.73,
		rotation: -3.1299
	},
	{
		name: ' ',
		period: null,
		x: 372.27,
		z: -16.1,
		width: 21.51,
		depth: 44.61,
		rotation: -0.0124
	},
	{
		name: ' ',
		period: null,
		x: 348.07,
		z: -13.21,
		width: 19.68,
		depth: 39.15,
		rotation: 3.1331
	},
	{
		name: ' ',
		period: null,
		x: 283.36,
		z: 174.74,
		width: 4.74,
		depth: 8.26,
		rotation: 3.1118
	},
	{
		name: ' ',
		period: null,
		x: 284.24,
		z: 185.82,
		width: 3.77,
		depth: 7.47,
		rotation: 0.0003
	},
	{
		name: ' ',
		period: null,
		x: 273.03,
		z: 172.29,
		width: 4.53,
		depth: 10.84,
		rotation: 1.5793
	},
	{
		name: ' ',
		period: null,
		x: 268.86,
		z: 179.56,
		width: 2.3,
		depth: 8.1,
		rotation: -0.0036
	},
	{
		name: ' ',
		period: null,
		x: 273.87,
		z: 180.1,
		width: 4.84,
		depth: 8.76,
		rotation: 3.1208
	},
	{
		name: ' ',
		period: null,
		x: 275.31,
		z: 189.78,
		width: 3.3,
		depth: 7.84,
		rotation: -0.0347
	},
	{
		name: ' ',
		period: null,
		x: 258.66,
		z: 228.51,
		width: 5.1,
		depth: 2.97,
		rotation: -1.6269
	},
	{
		name: ' ',
		period: null,
		x: 266.46,
		z: 215.61,
		width: 8.17,
		depth: 16.12,
		rotation: -0.0601
	},
	{
		name: ' ',
		period: null,
		x: 269.59,
		z: 192.04,
		width: 4.37,
		depth: 5.56,
		rotation: -0.0195
	},
	{
		name: ' ',
		period: null,
		x: 268.99,
		z: 200.14,
		width: 5.2,
		depth: 10.62,
		rotation: -0.0255
	},
	{
		name: ' ',
		period: null,
		x: 263.03,
		z: 201.13,
		width: 5.05,
		depth: 11.8,
		rotation: -0.0308
	},
	{
		name: ' ',
		period: null,
		x: 256.07,
		z: 209.01,
		width: 3.68,
		depth: 5.91,
		rotation: 0.1239
	},
	{
		name: ' ',
		period: null,
		x: 254.75,
		z: 202.37,
		width: 6.38,
		depth: 4.64,
		rotation: -1.4344
	},
	{
		name: ' ',
		period: null,
		x: 249.62,
		z: 204.96,
		width: 17.11,
		depth: 4.21,
		rotation: -1.5734
	},
	{
		name: ' ',
		period: null,
		x: 252.17,
		z: 221.76,
		width: 5.2,
		depth: 20.92,
		rotation: -3.121
	},
	{
		name: ' ',
		period: null,
		x: 242.23,
		z: 222.37,
		width: 4.63,
		depth: 15.04,
		rotation: 3.0863
	},
	{
		name: ' ',
		period: null,
		x: 237.87,
		z: 204.78,
		width: 11.43,
		depth: 15.75,
		rotation: -0.0142
	},
	{
		name: ' ',
		period: null,
		x: 248.97,
		z: 189.82,
		width: 13.12,
		depth: 4.17,
		rotation: -1.5736
	},
	{
		name: ' ',
		period: null,
		x: 243.22,
		z: 192.15,
		width: 7.5,
		depth: 8.57,
		rotation: 3.1347
	},
	{
		name: ' ',
		period: null,
		x: 236.14,
		z: 190.14,
		width: 6.67,
		depth: 13.58,
		rotation: -0.0077
	},
	{
		name: ' ',
		period: null,
		x: 263.65,
		z: 186.11,
		width: 5.3,
		depth: 16.65,
		rotation: -0.0156
	},
	{
		name: ' ',
		period: null,
		x: 256.45,
		z: 185.82,
		width: 8.46,
		depth: 15.21,
		rotation: -0.005
	},
	{
		name: ' ',
		period: null,
		x: 258.1,
		z: 173.68,
		width: 7.94,
		depth: 16.95,
		rotation: -1.5795
	},
	{
		name: ' ',
		period: null,
		x: 401.65,
		z: 35.38,
		width: 13.36,
		depth: 37.34,
		rotation: -0.0052
	},
	{
		name: ' ',
		period: null,
		x: 243.96,
		z: 177.7,
		width: 8.67,
		depth: 20.14,
		rotation: 3.1249
	},
	{
		name: ' ',
		period: null,
		x: 212.89,
		z: 190.95,
		width: 26.53,
		depth: 12.97,
		rotation: 1.5664
	},
	{
		name: ' ',
		period: null,
		x: 199.12,
		z: 190.91,
		width: 11.97,
		depth: 26.47,
		rotation: 3.1303
	},
	{
		name: ' ',
		period: null,
		x: 183.7,
		z: 194.9,
		width: 12.96,
		depth: 26.34,
		rotation: -0.0142
	},
	{
		name: ' ',
		period: null,
		x: 386.5,
		z: 288.19,
		width: 20,
		depth: 51.98,
		rotation: 0.0208
	},
	{
		name: ' ',
		period: null,
		x: 376.33,
		z: 240.03,
		width: 37.39,
		depth: 18.57,
		rotation: -1.5631
	},
	{
		name: ' ',
		period: null,
		x: 353.32,
		z: 255.6,
		width: 18.02,
		depth: 37.26,
		rotation: 0.0013
	},
	{
		name: ' ',
		period: null,
		x: 320.67,
		z: 247,
		width: 15.95,
		depth: 39.86,
		rotation: -0.0038
	},
	{
		name: ' ',
		period: null,
		x: 370.8,
		z: 197.94,
		width: 17.07,
		depth: 37.15,
		rotation: -0.0088
	},
	{
		name: ' ',
		period: null,
		x: 394.53,
		z: 178.47,
		width: 18.06,
		depth: 37.37,
		rotation: 0.0126
	},
	{
		name: ' ',
		period: null,
		x: 393.55,
		z: 136.41,
		width: 18.46,
		depth: 36.48,
		rotation: 0.0181
	},
	{
		name: ' ',
		period: null,
		x: 370.37,
		z: 145.38,
		width: 18.12,
		depth: 52.42,
		rotation: 0.0073
	},
	{
		name: ' ',
		period: null,
		x: 348.02,
		z: 129.6,
		width: 18.18,
		depth: 19.31,
		rotation: -1.5369
	},
	{
		name: ' ',
		period: null,
		x: 347.46,
		z: 164.48,
		width: 20.04,
		depth: 50.28,
		rotation: 0.003
	},
	{
		name: ' ',
		period: null,
		x: 347.55,
		z: 212.29,
		width: 18.18,
		depth: 37.51,
		rotation: -0.0073
	},
	{
		name: ' ',
		period: null,
		x: 320.85,
		z: 196.19,
		width: 17.92,
		depth: 51.74,
		rotation: -0.016
	},
	{
		name: ' ',
		period: null,
		x: 297.68,
		z: 196.54,
		width: 20.73,
		depth: 55.78,
		rotation: -0.0056
	},
	{
		name: ' ',
		period: null,
		x: 362.53,
		z: 60.87,
		width: 51.69,
		depth: 104.36,
		rotation: -0.0123
	},
	{
		name: null,
		period: null,
		x: 391.43,
		z: 65.81,
		width: 4.18,
		depth: 5.47,
		rotation: -0.0081
	},
	{
		name: null,
		period: null,
		x: 391.27,
		z: 77.96,
		width: 4.5,
		depth: 13.49,
		rotation: 3.1302
	},
	{
		name: null,
		period: null,
		x: 391.72,
		z: 33.02,
		width: 5.24,
		depth: 8.43,
		rotation: -0.0026
	},
	{
		name: null,
		period: null,
		x: 392.49,
		z: 43.67,
		width: 3.45,
		depth: 12.94,
		rotation: -0.0178
	},
	{
		name: null,
		period: null,
		x: 396.57,
		z: 12.56,
		width: 6.71,
		depth: 10.47,
		rotation: -3.1177
	},
	{
		name: null,
		period: null,
		x: 404.65,
		z: 12.74,
		width: 5.2,
		depth: 8.35,
		rotation: -3.1392
	},
	{
		name: null,
		period: null,
		x: 325.59,
		z: -6.82,
		width: 10.96,
		depth: 15.23,
		rotation: -3.1095
	},
	{
		name: null,
		period: null,
		x: 323.1,
		z: 4.88,
		width: 9.1,
		depth: 12.33,
		rotation: -1.5756
	},
	{
		name: null,
		period: null,
		x: 401.7,
		z: 224.34,
		width: 8.62,
		depth: 22.23,
		rotation: -0.0676
	},
	{
		name: null,
		period: null,
		x: 398.47,
		z: 208.78,
		width: 2.25,
		depth: 7.28,
		rotation: -0.0393
	},
	{
		name: null,
		period: null,
		x: 401.15,
		z: 206.72,
		width: 3.1,
		depth: 11.32,
		rotation: -0.0254
	},
	{
		name: null,
		period: null,
		x: 405.36,
		z: 204.57,
		width: 7.09,
		depth: 3.71,
		rotation: 1.5335
	},
	{
		name: null,
		period: null,
		x: 404.85,
		z: 210.14,
		width: 4.27,
		depth: 4.49,
		rotation: -1.5929
	},
	{
		name: null,
		period: null,
		x: 415.75,
		z: 216.25,
		width: 3.97,
		depth: 9.71,
		rotation: -0.0533
	},
	{
		name: null,
		period: null,
		x: 413.83,
		z: 231.16,
		width: 4.54,
		depth: 12.48,
		rotation: -0.0866
	},
	{
		name: null,
		period: null,
		x: 408.97,
		z: 230.03,
		width: 12.16,
		depth: 4.1,
		rotation: 1.4999
	},
	{
		name: null,
		period: null,
		x: 419.96,
		z: 229.08,
		width: 10.07,
		depth: 4.36,
		rotation: 1.4683
	},
	{
		name: null,
		period: null,
		x: 407.36,
		z: 242.42,
		width: 5.87,
		depth: 11.1,
		rotation: -0.0018
	},
	{
		name: null,
		period: null,
		x: 417.71,
		z: 252.3,
		width: 8.97,
		depth: 4.68,
		rotation: 1.5616
	},
	{
		name: null,
		period: null,
		x: 435.75,
		z: 243.32,
		width: 7.49,
		depth: 14.59,
		rotation: 0.1125
	},
	{
		name: null,
		period: null,
		x: 431.59,
		z: 229.91,
		width: 5.42,
		depth: 10.92,
		rotation: -0.0961
	},
	{
		name: null,
		period: null,
		x: 425.66,
		z: 229.37,
		width: 10.42,
		depth: 4.87,
		rotation: -1.6772
	},
	{
		name: null,
		period: null,
		x: 420.97,
		z: 206.82,
		width: 4.46,
		depth: 13.31,
		rotation: -0.0088
	},
	{
		name: null,
		period: null,
		x: 414.65,
		z: 204.92,
		width: 6.71,
		depth: 11.31,
		rotation: -0.0132
	},
	{
		name: null,
		period: null,
		x: 373.99,
		z: 282.98,
		width: 3.81,
		depth: 9.97,
		rotation: 3.1256
	},
	{
		name: null,
		period: null,
		x: 400.31,
		z: 281.89,
		width: 5.87,
		depth: 13.1,
		rotation: 0.0162
	},
	{
		name: null,
		period: null,
		x: 407.29,
		z: 281.52,
		width: 6.55,
		depth: 13.55,
		rotation: 0.0133
	},
	{
		name: null,
		period: null,
		x: 414.49,
		z: 286.73,
		width: 4.99,
		depth: 9.27,
		rotation: -0.0996
	},
	{
		name: null,
		period: null,
		x: 411.82,
		z: 299.9,
		width: 7.78,
		depth: 15.02,
		rotation: 0.0189
	},
	{
		name: null,
		period: null,
		x: 397.72,
		z: 318.84,
		width: 4.87,
		depth: 7.03,
		rotation: -0.1424
	},
	{
		name: null,
		period: null,
		x: 412.5,
		z: 328.69,
		width: 6.27,
		depth: 8.46,
		rotation: -0.0513
	}
];
