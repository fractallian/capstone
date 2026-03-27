import { Piece } from './Piece';
import type { Player } from './Player';
import { Stack, StackLocation } from './Stack';

export class Pool {
	player: Player;
	stacks: Stack[] = [];

	constructor(player: Player) {
		this.player = player;
		for (let i = 0; i < 3; i++) {
			const stack = new Stack(player.game, StackLocation.pool);
			this.stacks.push(stack);
			for (let p = 0; p < 4; p++) {
				const piece = new Piece(player, p, stack);
				stack.pieces.push(piece);
			}
		}
	}
}
