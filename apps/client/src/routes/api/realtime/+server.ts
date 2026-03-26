import { json } from '@sveltejs/kit';
import { getColyseusPort, getColyseusPublicUrl } from '$lib/server/realtime/server';

export const GET = async () => {
	return json({
		roomName: 'capstone',
		transport: 'colyseus-websocket',
		port: getColyseusPort(),
		publicUrl: getColyseusPublicUrl()
	});
};
