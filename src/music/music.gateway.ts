import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'music',
})
export class MusicGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MusicGateway.name);

  @SubscribeMessage('subscribeToSong')
  handleSubscribeToSong(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (data && data.songId) {
      const roomName = `song:${data.songId}`;
      void client.join(roomName);
      this.logger.log(`Client ${client.id} joined room ${roomName}`);
      return { status: 'subscribed', room: roomName };
    }
    return { status: 'error', message: 'Invalid songId' };
  }

  emitSongStatusUpdate(songId: string, payload: any) {
    const roomName = `song:${songId}`;
    this.server.to(roomName).emit('song:status-updated', payload);
    this.logger.log(`Emitted status-updated to room ${roomName}`);
  }
}
