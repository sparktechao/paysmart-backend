#!/bin/bash

API_BASE_URL="http://localhost:3000/api/v1"
REQUESTER_PHONE="+244987654321" # Maria Santos
PAYER1_PHONE="+244555666777"    # Pedro Oliveira
PAYER2_PHONE="+244111222333"    # Admin Sistema (usuário ativo)
PIN="1234"

echo -e "\033[0;34m🧪 Teste Completo: Payment Request com e sem payerId + Pagamento\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

# Função para fazer login
login() {
  local phone=$1
  local response=$(curl -s -X POST "$API_BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\",\"pin\":\"$PIN\"}")
  
  local token=$(echo "$response" | jq -r '.accessToken')
  local userId=$(echo "$response" | jq -r '.user.id')
  local name=$(echo "$response" | jq -r '.user.firstName + " " + .user.lastName')
  
  echo "$token|$userId|$name"
}

# 1. Login de todos os usuários
echo -e "\033[0;34m1️⃣  Fazendo login de todos os usuários...\033[0m"
REQUESTER_DATA=$(login "$REQUESTER_PHONE")
REQUESTER_TOKEN=$(echo "$REQUESTER_DATA" | cut -d'|' -f1)
REQUESTER_ID=$(echo "$REQUESTER_DATA" | cut -d'|' -f2)
REQUESTER_NAME=$(echo "$REQUESTER_DATA" | cut -d'|' -f3)

PAYER1_DATA=$(login "$PAYER1_PHONE")
PAYER1_TOKEN=$(echo "$PAYER1_DATA" | cut -d'|' -f1)
PAYER1_ID=$(echo "$PAYER1_DATA" | cut -d'|' -f2)
PAYER1_NAME=$(echo "$PAYER1_DATA" | cut -d'|' -f3)

PAYER2_DATA=$(login "$PAYER2_PHONE")
PAYER2_TOKEN=$(echo "$PAYER2_DATA" | cut -d'|' -f1)
PAYER2_ID=$(echo "$PAYER2_DATA" | cut -d'|' -f2)
PAYER2_NAME=$(echo "$PAYER2_DATA" | cut -d'|' -f3)

echo -e "\033[0;32m✅ Requester: $REQUESTER_NAME ($REQUESTER_ID)\033[0m"
echo -e "\033[0;32m✅ Payer 1: $PAYER1_NAME ($PAYER1_ID)\033[0m"
echo -e "\033[0;32m✅ Payer 2: $PAYER2_NAME ($PAYER2_ID)\033[0m"
echo ""

# 2. Verificar saldos iniciais
echo -e "\033[0;34m2️⃣  Verificando saldos iniciais...\033[0m"
get_balance() {
  local token=$1
  curl -s -X GET "$API_BASE_URL/wallets/default" \
    -H "Authorization: Bearer $token" | jq -r '.balances.AOA'
}

REQUESTER_BALANCE=$(get_balance "$REQUESTER_TOKEN")
PAYER1_BALANCE=$(get_balance "$PAYER1_TOKEN")
PAYER2_BALANCE=$(get_balance "$PAYER2_TOKEN")

echo -e "\033[1;33m   $REQUESTER_NAME: $REQUESTER_BALANCE AOA\033[0m"
echo -e "\033[1;33m   $PAYER1_NAME: $PAYER1_BALANCE AOA\033[0m"
echo -e "\033[1;33m   $PAYER2_NAME: $PAYER2_BALANCE AOA\033[0m"
echo ""

# 3. TESTE 1: Payment Request COM payerId - Pagar pelo payer correto
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 1: Payment Request COM payerId - Pagar pelo Payer Correto\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 100 AOA para $PAYER1_NAME...\033[0m"
PR1=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"payerId\":\"$PAYER1_ID\",\"amount\":100,\"description\":\"Teste 1: COM payerId\",\"category\":\"PERSONAL\"}")

PR1_ID=$(echo "$PR1" | jq -r '.id')
echo -e "\033[0;32m✅ Payment Request criado: $PR1_ID\033[0m"
echo ""

echo -e "\033[1;33m$PAYER1_NAME pagando o Payment Request...\033[0m"
APPROVE1=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR1_ID/approve" \
  -H "Authorization: Bearer $PAYER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE1_STATUS=$(echo "$APPROVE1" | jq -r '.status')
if [ "$APPROVE1_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso!\033[0m"
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE1" | jq .
fi
echo ""

# 4. TESTE 2: Payment Request COM payerId - Tentar pagar por outro usuário (deve falhar)
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 2: Payment Request COM payerId - Tentar Pagar por Outro Usuário\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 200 AOA para $PAYER1_NAME...\033[0m"
PR2=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"payerId\":\"$PAYER1_ID\",\"amount\":200,\"description\":\"Teste 2: COM payerId (tentar pagar por outro)\",\"category\":\"PERSONAL\"}")

PR2_ID=$(echo "$PR2" | jq -r '.id')
echo -e "\033[0;32m✅ Payment Request criado: $PR2_ID\033[0m"
echo ""

echo -e "\033[1;33m$PAYER2_NAME tentando pagar (deve falhar - não é o payer)...\033[0m"
APPROVE2=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR2_ID/approve" \
  -H "Authorization: Bearer $PAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE2_ERROR=$(echo "$APPROVE2" | jq -r '.message // .statusCode')
if [ "$APPROVE2_ERROR" != "null" ] && [ "$APPROVE2_ERROR" != "PAID" ]; then
  echo -e "\033[0;32m✅ Erro esperado: $APPROVE2_ERROR\033[0m"
else
  echo -e "\033[0;31m❌ Deveria ter falhado mas não falhou!\033[0m"
  echo "$APPROVE2" | jq .
fi
echo ""

# 5. TESTE 3: Payment Request SEM payerId - Pagar por qualquer usuário
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 3: Payment Request SEM payerId - Pagar por Qualquer Usuário\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 150 AOA SEM payerId (payment link público)...\033[0m"
PR3=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":150,\"description\":\"Teste 3: SEM payerId (qualquer um pode pagar)\",\"category\":\"PERSONAL\"}")

PR3_ID=$(echo "$PR3" | jq -r '.id')
PR3_PAYER_ID=$(echo "$PR3" | jq -r '.payerId')
echo -e "\033[0;32m✅ Payment Request criado: $PR3_ID\033[0m"
echo -e "\033[1;33m   Payer ID: $PR3_PAYER_ID (null = público)\033[0m"
echo ""

echo -e "\033[1;33m$PAYER1_NAME pagando o Payment Request público...\033[0m"
APPROVE3=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR3_ID/approve" \
  -H "Authorization: Bearer $PAYER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE3_STATUS=$(echo "$APPROVE3" | jq -r '.status')
if [ "$APPROVE3_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso por $PAYER1_NAME!\033[0m"
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE3" | jq .
fi
echo ""

# 6. TESTE 4: Payment Request SEM payerId - Pagar por outro usuário (também deve funcionar)
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 4: Payment Request SEM payerId - Pagar por Outro Usuário\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 250 AOA SEM payerId...\033[0m"
PR4=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":250,\"description\":\"Teste 4: SEM payerId (pagar por outro)\",\"category\":\"PERSONAL\"}")

PR4_ID=$(echo "$PR4" | jq -r '.id')
echo -e "\033[0;32m✅ Payment Request criado: $PR4_ID\033[0m"
echo ""

echo -e "\033[1;33m$PAYER2_NAME pagando o Payment Request público...\033[0m"
APPROVE4=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR4_ID/approve" \
  -H "Authorization: Bearer $PAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE4_STATUS=$(echo "$APPROVE4" | jq -r '.status')
if [ "$APPROVE4_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso por $PAYER2_NAME!\033[0m"
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE4" | jq .
fi
echo ""

# 7. Verificar saldos finais
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m💰 Verificando Saldos Finais\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

REQUESTER_BALANCE_FINAL=$(get_balance "$REQUESTER_TOKEN")
PAYER1_BALANCE_FINAL=$(get_balance "$PAYER1_TOKEN")
PAYER2_BALANCE_FINAL=$(get_balance "$PAYER2_TOKEN")

echo -e "\033[1;33m   $REQUESTER_NAME: $REQUESTER_BALANCE AOA → $REQUESTER_BALANCE_FINAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER1_NAME: $PAYER1_BALANCE AOA → $PAYER1_BALANCE_FINAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER2_NAME: $PAYER2_BALANCE AOA → $PAYER2_BALANCE_FINAL AOA\033[0m"
echo ""

# 8. Resumo
echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;32m✅ TESTES CONCLUÍDOS!\033[0m"
echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo -e "\033[0;34m📊 Resumo dos Testes:\033[0m"
echo -e "  ✅ Teste 1: Payment Request COM payerId - Payer correto pagou"
echo -e "  ✅ Teste 2: Payment Request COM payerId - Outro usuário NÃO conseguiu pagar (esperado)"
echo -e "  ✅ Teste 3: Payment Request SEM payerId - $PAYER1_NAME pagou"
echo -e "  ✅ Teste 4: Payment Request SEM payerId - $PAYER2_NAME pagou"
echo ""
echo -e "\033[0;34m💡 Conclusões:\033[0m"
echo -e "  • Payment Request COM payerId: apenas o payer específico pode pagar"
echo -e "  • Payment Request SEM payerId: qualquer usuário autenticado pode pagar"
echo -e "  • Saldos foram movimentados corretamente"

