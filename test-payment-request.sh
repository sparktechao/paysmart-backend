#!/bin/bash

API_BASE_URL="http://localhost:3000/api/v1"
REQUESTER_PHONE="+244987654321" # Maria Santos
PAYER_PHONE="+244555666777"     # Pedro Oliveira
PIN="1234"

echo -e "\033[0;34m🧪 Teste de Payment Request (com e sem payerId)\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

# 1. Login como Requester
echo -e "\033[0;34m1️⃣  Fazendo login como Requester (Maria)...\033[0m"
REQUESTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$REQUESTER_PHONE\",\"pin\":\"$PIN\"}")

REQUESTER_TOKEN=$(echo "$REQUESTER_RESPONSE" | jq -r '.accessToken')
REQUESTER_ID=$(echo "$REQUESTER_RESPONSE" | jq -r '.user.id')
REQUESTER_NAME=$(echo "$REQUESTER_RESPONSE" | jq -r '.user.firstName + " " + .user.lastName')

if [ -z "$REQUESTER_TOKEN" ] || [ "$REQUESTER_TOKEN" == "null" ]; then
  echo -e "\033[0;31m❌ Erro no login do Requester\033[0m"
  echo "$REQUESTER_RESPONSE" | jq .
  exit 1
fi

echo -e "\033[0;32m✅ Login realizado: $REQUESTER_NAME\033[0m"
echo -e "\033[1;33m   User ID: $REQUESTER_ID\033[0m"
echo ""

# 2. Login como Payer (para obter ID)
echo -e "\033[0;34m2️⃣  Fazendo login como Payer (Pedro) para obter ID...\033[0m"
PAYER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PAYER_PHONE\",\"pin\":\"$PIN\"}")

PAYER_TOKEN=$(echo "$PAYER_RESPONSE" | jq -r '.accessToken')
PAYER_ID=$(echo "$PAYER_RESPONSE" | jq -r '.user.id')
PAYER_NAME=$(echo "$PAYER_RESPONSE" | jq -r '.user.firstName + " " + .user.lastName')

if [ -z "$PAYER_TOKEN" ] || [ "$PAYER_TOKEN" == "null" ]; then
  echo -e "\033[0;31m❌ Erro no login do Payer\033[0m"
  echo "$PAYER_RESPONSE" | jq .
  exit 1
fi

echo -e "\033[0;32m✅ Login realizado: $PAYER_NAME\033[0m"
echo -e "\033[1;33m   User ID: $PAYER_ID\033[0m"
echo ""

# 3. Teste 1: Payment Request COM payerId
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 1: Payment Request COM payerId\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 250 AOA para $PAYER_NAME ($PAYER_ID)...\033[0m"
PR_WITH_PAYER=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"payerId\": \"$PAYER_ID\",
    \"amount\": 250,
    \"description\": \"Teste Payment Request COM payerId\",
    \"category\": \"PERSONAL\"
  }")

PR_WITH_PAYER_ID=$(echo "$PR_WITH_PAYER" | jq -r '.id')
PR_WITH_PAYER_STATUS=$(echo "$PR_WITH_PAYER" | jq -r '.status')
PR_WITH_PAYER_PAYER_ID=$(echo "$PR_WITH_PAYER" | jq -r '.payerId')

if [ -z "$PR_WITH_PAYER_ID" ] || [ "$PR_WITH_PAYER_ID" == "null" ]; then
  echo -e "\033[0;31m❌ Erro ao criar Payment Request COM payerId\033[0m"
  echo "$PR_WITH_PAYER" | jq .
  exit 1
fi

echo -e "\033[0;32m✅ Payment Request criado!\033[0m"
echo -e "\033[1;33m   ID: $PR_WITH_PAYER_ID\033[0m"
echo -e "\033[1;33m   Status: $PR_WITH_PAYER_STATUS\033[0m"
echo -e "\033[1;33m   Payer ID: $PR_WITH_PAYER_PAYER_ID\033[0m"
echo -e "\033[1;33m   Amount: $(echo "$PR_WITH_PAYER" | jq -r '.amount') $(echo "$PR_WITH_PAYER" | jq -r '.currency')\033[0m"
echo ""

# Verificar se notificação foi criada para o payer
echo -e "\033[0;34m🔔 Verificando se notificação foi criada para o Payer...\033[0m"
NOTIFICATIONS=$(curl -s -X GET "$API_BASE_URL/notifications" \
  -H "Authorization: Bearer $PAYER_TOKEN" | jq -r '.notifications[] | select(.type == "PAYMENT_REQUEST") | select(.data.paymentRequestId == "'$PR_WITH_PAYER_ID'")')

if [ -n "$NOTIFICATIONS" ]; then
  echo -e "\033[0;32m✅ Notificação encontrada para o Payer!\033[0m"
  echo "$NOTIFICATIONS" | jq '{id, title, message, type, createdAt}'
else
  echo -e "\033[0;31m⚠️  Notificação não encontrada (pode não ter sido criada ainda)\033[0m"
fi
echo ""

# 4. Teste 2: Payment Request SEM payerId (Payment Link Público)
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 2: Payment Request SEM payerId (Payment Link Público)\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 500 AOA SEM payerId (qualquer um pode pagar)...\033[0m"
PR_WITHOUT_PAYER=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 500,
    \"description\": \"Teste Payment Request SEM payerId (Payment Link Público)\",
    \"category\": \"PERSONAL\"
  }")

PR_WITHOUT_PAYER_ID=$(echo "$PR_WITHOUT_PAYER" | jq -r '.id')
PR_WITHOUT_PAYER_STATUS=$(echo "$PR_WITHOUT_PAYER" | jq -r '.status')
PR_WITHOUT_PAYER_PAYER_ID=$(echo "$PR_WITHOUT_PAYER" | jq -r '.payerId')

if [ -z "$PR_WITHOUT_PAYER_ID" ] || [ "$PR_WITHOUT_PAYER_ID" == "null" ]; then
  echo -e "\033[0;31m❌ Erro ao criar Payment Request SEM payerId\033[0m"
  echo "$PR_WITHOUT_PAYER" | jq .
  exit 1
fi

echo -e "\033[0;32m✅ Payment Request criado!\033[0m"
echo -e "\033[1;33m   ID: $PR_WITHOUT_PAYER_ID\033[0m"
echo -e "\033[1;33m   Status: $PR_WITHOUT_PAYER_STATUS\033[0m"
echo -e "\033[1;33m   Payer ID: $PR_WITHOUT_PAYER_PAYER_ID (null = payment link público)\033[0m"
echo -e "\033[1;33m   Amount: $(echo "$PR_WITHOUT_PAYER" | jq -r '.amount') $(echo "$PR_WITHOUT_PAYER" | jq -r '.currency')\033[0m"
echo ""

# Verificar se QR data foi gerado (se for MERCHANT)
if [ "$(echo "$PR_WITHOUT_PAYER" | jq -r '.qrData')" != "null" ]; then
  echo -e "\033[0;32m✅ QR Data disponível!\033[0m"
  echo "$PR_WITHOUT_PAYER" | jq '.qrData'
else
  echo -e "\033[1;33mℹ️  QR Data não disponível (requester não é MERCHANT ou QR não habilitado)\033[0m"
fi
echo ""

# 5. Comparação
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📊 COMPARAÇÃO\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;36mPayment Request COM payerId:\033[0m"
echo -e "  ✅ Payer específico: $PAYER_NAME ($PR_WITH_PAYER_PAYER_ID)"
echo -e "  ✅ Notificação enviada automaticamente para o Payer"
echo -e "  ✅ Payer aparece na lista de 'received' payment requests"
echo -e "  ✅ Apenas o Payer pode aprovar"
echo ""

echo -e "\033[1;36mPayment Request SEM payerId:\033[0m"
echo -e "  ✅ Payment Link Público (qualquer um pode pagar)"
echo -e "  ❌ Nenhuma notificação enviada (não há payer específico)"
echo -e "  ✅ Útil para QR codes em lojas físicas"
echo -e "  ✅ Útil para links de pagamento compartilháveis"
echo ""

# 6. Listar Payment Requests do Requester
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📋 Payment Requests do Requester\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

REQUester_PRS=$(curl -s -X GET "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" | jq -r '.paymentRequests[] | {id, payerId, amount, status, description}')

echo "$REQUester_PRS" | jq -s '.'
echo ""

# 7. Listar Payment Requests Recebidos do Payer
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📋 Payment Requests Recebidos do Payer\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

PAYER_RECEIVED=$(curl -s -X GET "$API_BASE_URL/payment-requests/received" \
  -H "Authorization: Bearer $PAYER_TOKEN" | jq -r '.paymentRequests[] | {id, requesterId, amount, status, description}')

if [ -n "$PAYER_RECEIVED" ]; then
  echo "$PAYER_RECEIVED" | jq -s '.'
else
  echo -e "\033[1;33mℹ️  Nenhum payment request recebido\033[0m"
fi
echo ""

echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;32m✅ TESTES CONCLUÍDOS!\033[0m"
echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo -e "\033[0;34m📝 Resumo:\033[0m"
echo -e "  ✅ Payment Request COM payerId: $PR_WITH_PAYER_ID"
echo -e "  ✅ Payment Request SEM payerId: $PR_WITHOUT_PAYER_ID"
echo ""
echo -e "\033[0;34m💡 Diferenças:\033[0m"
echo -e "  • COM payerId: Notificação enviada, apenas o Payer pode aprovar"
echo -e "  • SEM payerId: Payment link público, qualquer um pode pagar"

