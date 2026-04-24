export type AnimateStackMoveOptions = {
	/** Total time for the flight (ms). */
	durationMs?: number;
	cssEasing?: string;
	/** Where to mount the flying clone (defaults to `document.body`). */
	container?: HTMLElement;
};

const DEFAULT_DURATION_MS = 380;
const DEFAULT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SUPPRESS_CLASS = 'stack--animate-suppress-top';

function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

function getTopLayer(stack: HTMLElement): HTMLElement | null {
	const layers = stack.querySelectorAll<HTMLElement>('.stack__layer');
	if (!layers.length) return null;
	return layers[layers.length - 1] ?? null;
}

/**
 * Visually moves a clone of the **top** piece from `fromStack` to `toStack` using CSS transition
 * on `transform`. Endpoints use **center-to-center** alignment between the source top layer and
 * the destination stack’s top layer (or whole stack if empty). Only touches the DOM (clone, fixed
 * overlay, optional suppress class on `toStack`). Does not read or modify game rules / move lists.
 *
 * While the clone flies, `toStack` gets {@link SUPPRESS_CLASS} so the real top piece at the
 * destination can appear under the flight without a visible “double” after state has updated.
 */
export function animateMove(
	fromStack: HTMLElement,
	toStack: HTMLElement,
	options?: AnimateStackMoveOptions
): Promise<void> {
	if (prefersReducedMotion()) {
		return Promise.resolve();
	}

	const topLayer = getTopLayer(fromStack);
	if (!topLayer) {
		return Promise.resolve();
	}

	const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
	const easing = options?.cssEasing ?? DEFAULT_EASING;
	const container = options?.container ?? document.body;

	const fromRect = topLayer.getBoundingClientRect();
	const toLayer = getTopLayer(toStack);
	const toRect = (toLayer ?? toStack).getBoundingClientRect();

	/** Align centers so the flight matches visually (top-left delta alone is wrong when rects differ). */
	const fromCx = fromRect.left + fromRect.width / 2;
	const fromCy = fromRect.top + fromRect.height / 2;
	const toCx = toRect.left + toRect.width / 2;
	const toCy = toRect.top + toRect.height / 2;

	const clone = topLayer.cloneNode(true) as HTMLElement;
	clone.classList.remove('stack__layer--draggable', 'stack__layer--dragging');
	clone.setAttribute('aria-hidden', 'true');

	const shell = document.createElement('div');
	shell.className = 'capstone-move-flight';
	shell.style.cssText = [
		'position:fixed',
		'left:0',
		'top:0',
		'width:100%',
		'height:100%',
		'pointer-events:none',
		'z-index:2147483000',
		'contain:layout style'
	].join(';');

	const flyer = document.createElement('div');
	flyer.style.cssText = [
		`position:absolute`,
		`left:${fromRect.left}px`,
		`top:${fromRect.top}px`,
		`width:${fromRect.width}px`,
		`height:${fromRect.height}px`,
		`will-change:transform`,
		`transition:transform ${durationMs}ms ${easing}`,
		`transform:translate3d(0,0,0)`,
		`filter:drop-shadow(0 6px 14px rgb(15 23 42 / 0.2))`
	].join(';');

	flyer.appendChild(clone);
	shell.appendChild(flyer);
	container.appendChild(shell);

	const dx = toCx - fromCx;
	const dy = toCy - fromCy;

	const cleanup = () => {
		toStack.classList.remove(SUPPRESS_CLASS);
		shell.remove();
	};

	return new Promise<void>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve();
		};

		const onEnd = (e: TransitionEvent) => {
			if (e.propertyName !== 'transform') return;
			flyer.removeEventListener('transitionend', onEnd);
			finish();
		};

		flyer.addEventListener('transitionend', onEnd);
		window.setTimeout(finish, durationMs + 120);

		requestAnimationFrame(() => {
			toStack.classList.add(SUPPRESS_CLASS);
			requestAnimationFrame(() => {
				flyer.style.transform = `translate3d(${dx}px,${dy}px,0)`;
			});
		});
	});
}

export { SUPPRESS_CLASS };

/**
 * Convenience: resolve stacks by `data-stack-index` under `root` (e.g. the game root element).
 */
export function animateMoveFromStackIndices(
	root: HTMLElement,
	fromIndex: number,
	toIndex: number,
	options?: AnimateStackMoveOptions
): Promise<void> {
	const fromStack = root.querySelector<HTMLElement>(`[data-stack-index="${fromIndex}"]`);
	const toStack = root.querySelector<HTMLElement>(`[data-stack-index="${toIndex}"]`);
	if (!fromStack || !toStack) {
		return Promise.resolve();
	}
	return animateMove(fromStack, toStack, options);
}
