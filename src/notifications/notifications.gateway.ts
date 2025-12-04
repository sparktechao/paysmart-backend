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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Socket> = new Map();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Extrair e validar token JWT
      const token = this.extractTokenFromClient(client);

      if (!token) {
        this.logger.warn('❌ Conexão rejeitada: token não fornecido');
        client.disconnect();
        return;
      }

      // Validar token JWT
      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(token);
      } catch (error) {
        this.logger.warn('❌ Conexão rejeitada: token inválido', {
          error: error instanceof Error ? error.message : String(error)
        });
        client.disconnect();
        return;
      }

      const userId = payload.sub;

      if (!userId) {
        this.logger.warn('❌ Conexão rejeitada: userId não encontrado no token', { payload });
        client.disconnect();
        return;
      }

      this.logger.log('🔌 Nova conexão WebSocket', {
        userId,
        socketId: client.id,
        phone: payload.phone,
      });

      // Armazenar dados do usuário no socket
      client.data.user = payload;

      // Armazenar socket do usuário
      this.userSockets.set(userId, client);

      // Juntar usuário a uma sala específica
      const room = `user:${userId}`;
      client.join(room);

      this.logger.log(`✅ Usuário conectado ao Socket.io`, {
        userId,
        socketId: client.id,
        room,
        totalUsers: this.userSockets.size
      });

      // Verificar se está realmente na sala
      const rooms = Array.from(client.rooms);
      this.logger.log(`📍 Socket ${client.id} está nas salas:`, rooms);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('❌ Erro na conexão Socket.io', errorStack, { error: errorMessage });
      client.disconnect();
    }
  }

  private extractTokenFromClient(client: Socket): string | undefined {
    let token = client.handshake.auth.token || client.handshake.headers.authorization;

    if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    return token;
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
    const room = `user:${userId}`;
    this.logger.log(`📤 Enviando notificação para sala: ${room}`, {
      userId,
      notificationId: notification.id,
      type: notification.type,
      title: notification.title,
    });
    
    // Verificar se há clientes na sala usando o socket do usuário
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      this.logger.log(`✅ Usuário ${userId} está conectado (Socket ID: ${userSocket.id})`);
    } else {
      this.logger.warn(`⚠️ Usuário ${userId} NÃO está conectado ao WebSocket`);
      this.logger.debug(`Usuários conectados: ${Array.from(this.userSockets.keys()).join(', ')}`);
    }
    
    // Verificar salas usando o adapter (se disponível)
    try {
      const adapter = (this.server as any).sockets?.adapter;
      if (adapter && adapter.rooms) {
        const roomClients = adapter.rooms.get(room);
        const clientCount = roomClients ? roomClients.size : 0;
        this.logger.log(`👥 Clientes na sala ${room}: ${clientCount}`);
        
        if (clientCount === 0) {
          this.logger.warn(`⚠️ Nenhum cliente na sala ${room} - notificação não será entregue`);
        }
      }
    } catch (error) {
      // Ignorar erro do adapter, não é crítico
    }
    
    // Enviar notificação
    this.server.to(room).emit('notification', notification);
    
    // Log de confirmação
    this.logger.log(`✅ Notificação emitida para sala ${room}`);
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
} 