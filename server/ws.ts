const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(ws: WebSocket, canvasId: string) {
  if (!rooms.has(canvasId)) {
    rooms.set(canvasId, new Set());
  }

  rooms.get(canvasId)!.add(ws);

  ws.onmessage = (event) => {
    for (const client of rooms.get(canvasId)!) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(event.data);
      }
    }
  };

  ws.onclose = () => {
    rooms.get(canvasId)!.delete(ws);
  };
}
