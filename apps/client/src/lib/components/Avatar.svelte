<script lang="ts">
	let {
		id = null,
		image = null,
		label = 'User avatar',
		sizeClass = 'h-9 w-9',
		textClass = 'text-xs',
		backgroundClass = 'bg-slate-200',
		foregroundClass = 'text-slate-700',
		additionalClass = ''
	}: {
		id?: string | null;
		image?: string | null;
		label?: string;
		sizeClass?: string;
		textClass?: string;
		backgroundClass?: string;
		foregroundClass?: string;
		additionalClass?: string;
	} = $props();

	let hasLoadError = $state(false);
	const clampedSize = $derived(Number.parseInt(sizeClass.match(/h-(\d+)/)?.[1] ?? '9', 10) * 4);
	const proxiedSrc = $derived(
		id && image ? `/api/avatar/${encodeURIComponent(id)}?size=${Math.max(32, clampedSize)}` : image
	);
	const initials = $derived(() => {
		const value = label.trim();
		if (value.length >= 2) return value.slice(0, 2).toUpperCase();
		return value.toUpperCase() || 'U';
	});
</script>

{#if proxiedSrc && !hasLoadError}
	<img
		src={proxiedSrc}
		alt={label}
		class={`${sizeClass} rounded-full object-cover ${additionalClass}`.trim()}
		onerror={() => (hasLoadError = true)}
	/>
{:else}
	<div
		class={`flex ${sizeClass} items-center justify-center rounded-full font-semibold ${textClass} ${backgroundClass} ${foregroundClass} ${additionalClass}`.trim()}
	>
		{initials}
	</div>
{/if}
