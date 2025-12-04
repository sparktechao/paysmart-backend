# 🔌 Referência da API

Documentação completa dos endpoints da API PaySmart Backend.

## 📋 Base URL

```
Desenvolvimento: http://localhost:3000/api/v1
Produção: https://api.paysmart.ao/api/v1
```

## 🔐 Autenticação

A maioria dos endpoints requer autenticação JWT. Inclua o token no header:

```
Authorization: Bearer {token}
```

### Obter Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "+244987654321",
  "pin": "1234"
}
```

**Resposta:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "firstName": "Maria",
    "lastName": "Santos",
    "phone": "+244987654321"
  }
}
```

## 👤 Usuários

### Obter Perfil

```http
GET /api/v1/users/profile
Authorization: Bearer {token}
```

### Atualizar Perfil

```http
PUT /api/v1/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "Maria",
  "lastName": "Santos",
  "email": "maria@example.com"
}
```

### Solicitar Validação

```http
POST /api/v1/users/request-validation
Authorization: Bearer {token}
Content-Type: application/json

{
  "referrerPhone": "+244987654321"
}
```

## 💰 Carteiras

### Listar Carteiras

```http
GET /api/v1/wallets
Authorization: Bearer {token}
```

### Criar Carteira

```http
POST /api/v1/wallets
Authorization: Bearer {token}
Content-Type: application/json

{
  "accountType": "PERSONAL",  // ou "BUSINESS" ou "MERCHANT"
  "currency": "AOA"
}
```

### Obter Carteira Padrão

```http
GET /api/v1/wallets/default
Authorization: Bearer {token}
```

### Obter Saldo

```http
GET /api/v1/wallets/{id}/balance
Authorization: Bearer {token}
```

## 💸 Transações

### Criar Transação

```http
POST /api/v1/transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "fromWalletId": "uuid",
  "toWalletId": "uuid",  // ou "toPhone": "+244987654321"
  "amount": 100.50,
  "currency": "AOA",
  "description": "Pagamento de teste",
  "type": "TRANSFER",
  "pin": "1234"
}
```

### Listar Transações

```http
GET /api/v1/transactions?type=TRANSFER&status=COMPLETED&limit=20&offset=0
Authorization: Bearer {token}
```

### Estatísticas de Transações

```http
GET /api/v1/transactions/stats
Authorization: Bearer {token}
```

## 📝 Payment Requests

### Criar Payment Request

```http
POST /api/v1/payment-requests
Authorization: Bearer {token}
Content-Type: application/json

{
  "payerId": "uuid",  // ou telefone: "+244987654321"
  "amount": 500,
  "description": "Pagamento de serviço",
  "category": "PERSONAL"
}
```

### Aprovar Payment Request

```http
PUT /api/v1/payment-requests/{id}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "pin": "1234"
}
```

### Listar Payment Requests Recebidos

```http
GET /api/v1/payment-requests/received?page=1&limit=20
Authorization: Bearer {token}
```

### Listar Pendentes

```http
GET /api/v1/payment-requests/pending
Authorization: Bearer {token}
```

### Gerar QR Code (MERCHANT)

```http
GET /api/v1/payment-requests/{id}/qr-code
Authorization: Bearer {token}
```

## 🔔 Notificações

### Listar Notificações

```http
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer {token}
```

### Marcar como Lida

```http
PUT /api/v1/notifications/{id}/read
Authorization: Bearer {token}
```

### Contador de Não Lidas

```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {token}
```

## 📊 Analytics

### Resumo do Dashboard

```http
GET /api/v1/dashboard/summary
Authorization: Bearer {token}
```

### Estatísticas

```http
GET /api/v1/dashboard/stats
Authorization: Bearer {token}
```

## 🔒 Segurança

### Alterar PIN

```http
POST /api/v1/security/change-pin
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPin": "1234",
  "newPin": "5678"
}
```

## 📚 Swagger UI

Para documentação interativa completa, acesse:

```
http://localhost:3000/api-docs
```

## 🔌 WebSocket

### Conectar

```javascript
const socket = io('http://localhost:3000/notifications', {
  path: '/socket.io',
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Escutar Notificações

```javascript
socket.on('notification', (notification) => {
  console.log('Nova notificação:', notification);
});
```

Para mais detalhes, veja [WebSocket e Notificações](./websocket-notifications.md).

## 📝 Códigos de Status

- `200 OK`: Sucesso
- `201 Created`: Recurso criado
- `400 Bad Request`: Dados inválidos
- `401 Unauthorized`: Token inválido ou ausente
- `403 Forbidden`: Sem permissão
- `404 Not Found`: Recurso não encontrado
- `500 Internal Server Error`: Erro do servidor

## 🔍 Filtros e Paginação

### Paginação

```
?page=1&limit=20
```

### Filtros de Transação

```
?type=TRANSFER&status=COMPLETED&currency=AOA&startDate=2024-01-01&endDate=2024-12-31
```

### Ordenação

```
?orderBy=createdAt&order=desc
```

---

Para documentação interativa completa, use o Swagger UI em `/api-docs`.

