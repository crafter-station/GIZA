import { BoxGeometry, type BufferGeometry, Group, type Material, Mesh, Quaternion, Vector3 } from 'three/webgpu';
import { INCH } from '../../data/khufu-courses.ts';
import { type InteriorPoint, interiorToLocal, PETRIE_INTERIOR, SCAN_PYRAMIDS } from '../../data/khufu-interior.ts';

export interface InteriorMaterials {
	limestone: Material;
	granite: Material;
	detected: Material;
}

export interface InteriorPiece {
	name: string;
	kind: 'passage' | 'chamber' | 'gallery' | 'detected';
	granite: boolean;
	center: [number, number, number];
	size: [number, number, number];
	rotation: [number, number, number, number];
}

const Z = new Vector3(0, 0, 1);

function segment(name: string, from: InteriorPoint, to: InteriorPoint, width: number, height: number): InteriorPiece {
	const a = new Vector3(...interiorToLocal(from));
	const b = new Vector3(...interiorToLocal(to));
	const direction = b.clone().sub(a);
	const length = direction.length();
	const rotation = new Quaternion().setFromUnitVectors(Z, direction.normalize());
	const center = a.add(b).multiplyScalar(0.5);
	return {
		name,
		kind: 'passage',
		granite: false,
		center: [center.x, center.y + (height * INCH) / 2, center.z],
		size: [width * INCH, height * INCH, length],
		rotation: [rotation.x, rotation.y, rotation.z, rotation.w]
	};
}

function room(
	name: string,
	kind: InteriorPiece['kind'],
	box: { north: number; south: number; east: number; west: number; floor: number; top: number },
	granite = false
): InteriorPiece {
	return {
		name,
		kind,
		granite,
		center: [
			((box.east + box.west) / 2) * INCH,
			((box.floor + box.top) / 2) * INCH,
			(-(box.north + box.south) / 2) * INCH
		],
		size: [(box.east - box.west) * INCH, (box.top - box.floor) * INCH, (box.north - box.south) * INCH],
		rotation: [0, 0, 0, 1]
	};
}

export function buildKhufuInterior(): InteriorPiece[] {
	const d = PETRIE_INTERIOR.value;
	const { width, height } = d.passage;
	const sub = d.subterraneanChamber;
	const pieces: InteriorPiece[] = [
		segment('Descending passage', d.entrance, d.descendingEnd, width, height),
		segment('Subterranean passage', d.descendingEnd, d.subterraneanPassageEnd, width, height),
		room('Subterranean chamber', 'chamber', {
			north: sub.center.north + sub.northSouth / 2,
			south: sub.center.north - sub.northSouth / 2,
			east: sub.center.east + sub.eastWest / 2,
			west: sub.center.east - sub.eastWest / 2,
			floor: sub.center.up - sub.height,
			top: sub.center.up
		}),
		segment('Ascending passage', d.ascendingStart, d.ascendingEnd, width, height),
		segment(
			'Queen’s Chamber passage',
			d.ascendingEnd,
			{ north: d.queensChamber.north, east: d.ascendingEnd.east, up: d.queensChamber.floor },
			width,
			height
		),
		room('Queen’s Chamber', 'chamber', {
			north: d.queensChamber.north,
			south: d.queensChamber.south,
			east: d.queensChamber.east,
			west: d.queensChamber.west,
			floor: d.queensChamber.floor,
			top: d.queensChamber.apex
		}),
		segment(
			'Passage to the antechamber',
			{ north: d.galleryEnd.north, east: d.galleryEnd.east, up: d.antechamber.floor },
			{ north: d.antechamber.north, east: d.galleryEnd.east, up: d.antechamber.floor },
			width,
			height
		),
		room(
			'Antechamber',
			'chamber',
			{
				north: d.antechamber.north,
				south: d.antechamber.south,
				east: d.galleryEnd.east + d.antechamber.width / 2,
				west: d.galleryEnd.east - d.antechamber.width / 2,
				floor: d.antechamber.floor,
				top: d.antechamber.roof
			},
			true
		),
		segment(
			'Passage to the King’s Chamber',
			{ north: d.antechamber.south, east: d.galleryEnd.east, up: d.kingsChamber.floor },
			{ north: d.kingsChamber.north, east: d.galleryEnd.east, up: d.kingsChamber.floor },
			width,
			height
		),
		room(
			'King’s Chamber',
			'chamber',
			{
				north: d.kingsChamber.north,
				south: d.kingsChamber.south,
				east: d.kingsChamber.east,
				west: d.kingsChamber.west,
				floor: d.kingsChamber.floor,
				top: d.kingsChamber.ceiling
			},
			true
		)
	];

	const gallery = d.galleryWidth;
	for (let lap = 0; lap < gallery.laps; lap++) {
		const t = lap / gallery.laps;
		const lapWidth = gallery.floor - (gallery.floor - gallery.top) * t;
		const piece = segment(
			`Grand Gallery lap ${lap + 1}`,
			d.ascendingEnd,
			d.galleryEnd,
			lapWidth,
			gallery.height / gallery.laps
		);
		piece.kind = 'gallery';
		piece.center[1] += (gallery.height * INCH * t) as number;
		pieces.push(piece);
	}

	const scan = SCAN_PYRAMIDS.value;
	const galleryLift = scan.bigVoid.aboveGallery;
	const voidPiece = segment('Big Void (detected)', d.ascendingEnd, d.galleryEnd, gallery.floor, gallery.height);
	voidPiece.kind = 'detected';
	voidPiece.center[1] += galleryLift;
	voidPiece.size[2] = Math.max(voidPiece.size[2], scan.bigVoid.minLength);
	pieces.push(voidPiece);

	const [ex, ey, ez] = interiorToLocal(d.entrance);
	const corridorY = ey + scan.northFaceCorridor.aboveEntrance;
	pieces.push({
		name: 'North Face Corridor (detected)',
		kind: 'detected',
		granite: false,
		center: [ex, corridorY + scan.northFaceCorridor.section / 2, ez + scan.northFaceCorridor.length / 2 + 1],
		size: [scan.northFaceCorridor.section, scan.northFaceCorridor.section, scan.northFaceCorridor.length],
		rotation: [0, 0, 0, 1]
	});
	return pieces;
}

export function createKhufuInterior(materials: InteriorMaterials): Group {
	const group = new Group();
	group.name = 'khufu-interior';
	const unit: BufferGeometry = new BoxGeometry(1, 1, 1);
	for (const piece of buildKhufuInterior()) {
		const material =
			piece.kind === 'detected' ? materials.detected : piece.granite ? materials.granite : materials.limestone;
		const mesh = new Mesh(unit, material);
		mesh.name = piece.name;
		mesh.position.set(...piece.center);
		mesh.scale.set(...piece.size);
		mesh.quaternion.set(...piece.rotation);
		mesh.renderOrder = piece.kind === 'detected' ? 2 : 1;
		group.add(mesh);
	}
	return group;
}
