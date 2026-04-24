export function randomStartingTurnIndex(): 0 | 1 {
	return Math.random() < 0.5 ? 0 : 1;
}
