<script lang="ts">
	import { PieceSize, PlayerColor } from '@capstone/game-logic';

	import orangeLarge from '$lib/assets/pieces/orange-large.svg?url';
	import orangeMedium from '$lib/assets/pieces/orange-medium.svg?url';
	import orangeSmall from '$lib/assets/pieces/orange-small.svg?url';
	import orangeTiny from '$lib/assets/pieces/orange-tiny.svg?url';

	import purpleLarge from '$lib/assets/pieces/purple-large.svg?url';
	import purpleMedium from '$lib/assets/pieces/purple-medium.svg?url';
	import purpleSmall from '$lib/assets/pieces/purple-small.svg?url';
	import purpleTiny from '$lib/assets/pieces/purple-tiny.svg?url';

	export type PieceProps = {
		size: PieceSize;
		color: PlayerColor;
		class?: string;
	};

	let { size, color, class: className }: PieceProps = $props();

	const srcByColorAndSize = {
		orange: {
			[PieceSize.One]: orangeTiny,
			[PieceSize.Two]: orangeSmall,
			[PieceSize.Three]: orangeMedium,
			[PieceSize.Four]: orangeLarge
		},
		purple: {
			[PieceSize.One]: purpleTiny,
			[PieceSize.Two]: purpleSmall,
			[PieceSize.Three]: purpleMedium,
			[PieceSize.Four]: purpleLarge
		}
	} as const;

	// Assumption: map White→orange and Black→purple.
	// If you want the inverse, swap these two strings.
	let colorKey: 'orange' | 'purple' = $derived(color === PlayerColor.White ? 'orange' : 'purple');
	let src = $derived(srcByColorAndSize[colorKey][size]);

	// Visual sizing inside a fixed square cell.
	// Keeps all Piece components occupying the same layout box while rendering smaller pieces with surrounding space.
	const scaleBySize = {
		[PieceSize.One]: 0.55,
		[PieceSize.Two]: 0.7,
		[PieceSize.Three]: 0.85,
		[PieceSize.Four]: 1
	} as const;

	let scale = $derived(scaleBySize[size]);
</script>

<div class={`piece ${className ?? ''}`.trim()} style={`--piece-scale:${scale};`}>
	<img class="piece__img" {src} alt="" draggable="false" />
</div>

<style>
	.piece {
		width: 100%;
		height: 100%;
		aspect-ratio: 1 / 1;
		display: grid;
		place-items: center;
	}

	.piece__img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		transform: scale(var(--piece-scale, 1));
		transform-origin: center;
		pointer-events: none;
		user-select: none;
	}
</style>
