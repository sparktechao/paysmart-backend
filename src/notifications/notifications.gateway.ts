import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from '../common/auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
@UseGuards(WsJwtGuard)
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Socket> = new Map();

  async handleConnection(client: Socket) {
    try {
      // Extrair token do handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization;
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Em produção, você validaria o token JWT aqui
      // Por simplicidade, vamos assumir que o userId está no token
      const userId = this.extractUserIdFromToken(token);
      
      if (!userId) {
        client.disconnect();
        return;
      }

      // Armazenar socket do usuário
      this.userSockets.set(userId, client);
      
      // Juntar usuário a uma sala específica
      client.join(`user:${userId}`);
      
      this.logger.log(`Usuário conectado ao Socket.io`, { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro na conexão Socket.io', errorStack, { error: errorMessage });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Remover usuário do mapa de sockets
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket === client) {
        this.userSockets.delete(userId);
        this.logger.log(`Usuário desconectado do Socket.io`, { userId });
        break;
      }
    }
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    client.join(`user:${data.userId}`);
    return { event: 'joined', data: { userId: data.userId } };
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    client.leave(`user:${data.userId}`);
    return { event: 'left', data: { userId: data.userId } };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: { timestamp: Date.now() } };
  }

  // Método para enviar notificação para um usuário específico
  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  // Método para enviar notificação para múltiplos usuários
  sendBulkNotification(userIds: string[], notification: any) {
    userIds.forEach(userId => {
      this.server.to(`user:${userId}`).emit('notification', notification);
    });
  }

  // Método para enviar notificação para todos os usuários conectados
  broadcastNotification(notification: any) {
    this.server.emit('notification', notification);
  }

  // Método para enviar notificação para uma sala específica
  sendToRoom(room: string, notification: any) {
    this.server.to(room).emit('notification', notification);
  }

  // Método para verificar se um usuário está online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Método para obter número de usuários conectados
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  // Método para obter lista de usuários conectados
  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  private extractUserIdFromToken(token: string): string | null {
    try {
      // Em produção, você validaria o JWT token aqui
      // Por simplicidade, vamos assumir que o token contém o userId
      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }
      
      // Decodificar JWT (simplificado)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.userId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('Erro ao extrair userId do token', { error: errorMessage });
      return null;
    }
  }
} 