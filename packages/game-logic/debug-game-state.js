import { Game } from './lib/Game.js';
import { viewGameState } from './lib/viewGameState.js';

const game = new Game();
const state = viewGameState(game);
console.log('Current game state:');
console.log(JSON.stringify(state));
console.log('Actual output:');
console.log(state);