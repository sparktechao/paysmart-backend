# 🔌 WebSocket e Notificações em Tempo Real

Guia completo para integração com o sistema de notificações WebSocket do PaySmart Backend.

## 🌐 Conexão

### URL Base

```
Desenvolvimento: ws://localhost:3000/notifications
Produção: wss://api.paysmart.ao/notifications
```

### Conectar ao WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  path: '/socket.io',
  auth: {
    token: 'your-jwt-token'  // Token obtido do login
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

## 🔐 Autenticação

O WebSocket requer autenticação JWT. O token deve ser enviado no handshake:

```javascript
socket = io('http://localhost:3000/notifications', {
  auth: {
    token: jwtToken  // Token do login
  }
});
```

## 📡 Eventos

### Eventos do Cliente → Servidor

#### Ping

```javascript
socket.emit('ping');
```

**Resposta:**
```javascript
socket.on('pong', (data) => {
  console.log('Timestamp:', data.timestamp);
});
```

### Eventos do Servidor → Cliente

#### Notification

Recebe notificações em tempo real:

```javascript
socket.on('notification', (notification) => {
  console.log('Nova notificação:', notification);
  // {
  //   id: "uuid",
  //   type: "PAYMENT_REQUEST",
  //   title: "Nova Solicitação de Pagamento",
  //   message: "Você recebeu uma solicitação...",
  //   data: { paymentRequestId: "..." },
  //   createdAt: "2024-12-03T..."
  // }
});
```

#### Connect

```javascript
socket.on('connect', () => {
  console.log('Conectado! Socket ID:', socket.id);
});
```

#### Disconnect

```javascript
socket.on('disconnect', (reason) => {
  console.log('Desconectado:', reason);
});
```

#### Connect Error

```javascript
socket.on('connect_error', (error) => {
  console.error('Erro de conexão:', error.message);
});
```

## 🏠 Salas (Rooms)

### Sistema de Salas

Cada usuário é automaticamente adicionado à sala `user:{userId}` quando conecta.

**Exemplo:**
- Usuário com ID `abc-123` → Sala: `user:abc-123`
- Notificações para esse usuário são enviadas para essa sala

### Como Funciona

1. **Conexão**: Usuário conecta e é adicionado à sua sala
2. **Notificação**: Sistema envia notificação para `user:{userId}`
3. **Entrega**: Socket.io entrega a notificação para todos os sockets na sala

## 📨 Tipos de Notificações

### PAYMENT_REQUEST

Enviada quando um Payment Request é criado para o usuário:

```javascript
{
  type: "PAYMENT_REQUEST",
  title: "Nova Solicitação de Pagamento",
  message: "Você recebeu uma solicitação de pagamento de 500 AOA",
  data: {
    paymentRequestId: "uuid"
  }
}
```

### PAYMENT_RECEIVED

Enviada quando o usuário recebe um pagamento:

```javascript
{
  type: "PAYMENT_RECEIVED",
  title: "Pagamento Recebido",
  message: "Você recebeu 500 AOA de João Silva",
  data: {
    paymentRequestId: "uuid",
    transactionId: "uuid",
    transactionReference: "TXN..."
  }
}
```

### PAYMENT_SENT

Enviada quando o usuário realiza um pagamento:

```javascript
{
  type: "PAYMENT_SENT",
  title: "Pagamento Realizado",
  message: "Você pagou 500 AOA para Maria Santos",
  data: {
    paymentRequestId: "uuid",
    transactionId: "uuid"
  }
}
```

## 💡 Exemplo Completo

```javascript
import io from 'socket.io-client';

class NotificationService {
  constructor(jwtToken) {
    this.socket = io('http://localhost:3000/notifications', {
      path: '/socket.io',
      auth: { token: jwtToken },
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Conectado ao WebSocket');
      this.socket.emit('ping');
    });

    this.socket.on('pong', (data) => {
      console.log('Pong recebido:', new Date(data.timestamp));
    });

    this.socket.on('notification', (notification) => {
      this.handleNotification(notification);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Desconectado:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erro de conexão:', error);
    });
  }

  handleNotification(notification) {
    switch (notification.type) {
      case 'PAYMENT_REQUEST':
        this.showPaymentRequestNotification(notification);
        break;
      case 'PAYMENT_RECEIVED':
        this.showPaymentReceivedNotification(notification);
        break;
      case 'PAYMENT_SENT':
        this.showPaymentSentNotification(notification);
        break;
      default:
        console.log('Notificação:', notification);
    }
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Uso
const notificationService = new NotificationService(jwtToken);
```

## 🔄 Fluxo de Notificações

### Payment Request

```
1. Requester cria Payment Request
   ↓
2. Sistema cria notificação no banco
   ↓
3. Sistema envia para sala user:{payerId}
   ↓
4. Payer recebe notificação em tempo real
```

### Payment Aprovado

```
1. Payer aprova Payment Request
   ↓
2. Sistema processa transação
   ↓
3. Sistema cria 2 notificações:
   - PAYMENT_RECEIVED → user:{requesterId}
   - PAYMENT_SENT → user:{payerId}
   ↓
4. Ambos recebem notificações em tempo real
```

## 🐛 Troubleshooting

### Não recebe notificações

1. **Verificar conexão:**
   ```javascript
   console.log('Conectado:', socket.connected);
   console.log('Socket ID:', socket.id);
   ```

2. **Verificar token:**
   - Token deve ser válido
   - Token deve estar no formato correto

3. **Verificar sala:**
   - Usuário deve estar na sala `user:{userId}`
   - Verificar se o userId corresponde

### Erro de conexão

```javascript
socket.on('connect_error', (error) => {
  if (error.message.includes('Unauthorized')) {
    // Token inválido - fazer novo login
  } else {
    // Outro erro de conexão
  }
});
```

## 📝 Boas Práticas

1. **Reconexão Automática**: Use `reconnection: true`
2. **Tratamento de Erros**: Sempre trate `connect_error`
3. **Cleanup**: Desconecte quando não precisar mais
4. **Token Refresh**: Renove o token antes de expirar
5. **Logs**: Adicione logs para debug

## 🔒 Segurança

- ✅ Token JWT é validado na conexão
- ✅ Cada usuário só recebe notificações destinadas a ele
- ✅ Conexões não autenticadas são rejeitadas
- ✅ Salas são isoladas por userId

---

Para mais informações, consulte a [Referência da API](./api-reference.md).

