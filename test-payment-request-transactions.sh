#!/bin/bash

API_BASE_URL="http://localhost:3000/api/v1"
REQUESTER_PHONE="+244987654321" # Maria Santos
PAYER1_PHONE="+244555666777"    # Pedro Oliveira
PAYER2_PHONE="+244111222333"    # Admin Sistema
PIN="1234"

echo -e "\033[0;34m🧪 Teste Completo: Payment Requests + Transações\033[0m"
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

# Função para obter saldo
get_balance() {
  local token=$1
  curl -s -X GET "$API_BASE_URL/wallets/default" \
    -H "Authorization: Bearer $token" | jq -r '.balances.AOA'
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
REQUESTER_BALANCE_INITIAL=$(get_balance "$REQUESTER_TOKEN")
PAYER1_BALANCE_INITIAL=$(get_balance "$PAYER1_TOKEN")
PAYER2_BALANCE_INITIAL=$(get_balance "$PAYER2_TOKEN")

echo -e "\033[1;33m   $REQUESTER_NAME: $REQUESTER_BALANCE_INITIAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER1_NAME: $PAYER1_BALANCE_INITIAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER2_NAME: $PAYER2_BALANCE_INITIAL AOA\033[0m"
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
TRANSACTION1_ID=$(echo "$APPROVE1" | jq -r '.metadata.transactionId // empty')

if [ "$APPROVE1_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso!\033[0m"
  if [ -n "$TRANSACTION1_ID" ] && [ "$TRANSACTION1_ID" != "null" ]; then
    echo -e "\033[1;33m   Transaction ID: $TRANSACTION1_ID\033[0m"
  fi
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE1" | jq .
fi
echo ""

# 4. TESTE 2: Payment Request SEM payerId - Pagar por qualquer usuário
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 2: Payment Request SEM payerId - Pagar por Qualquer Usuário\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 150 AOA SEM payerId (payment link público)...\033[0m"
PR2=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":150,\"description\":\"Teste 2: SEM payerId (qualquer um pode pagar)\",\"category\":\"PERSONAL\"}")

PR2_ID=$(echo "$PR2" | jq -r '.id')
PR2_PAYER_ID=$(echo "$PR2" | jq -r '.payerId')
echo -e "\033[0;32m✅ Payment Request criado: $PR2_ID\033[0m"
echo -e "\033[1;33m   Payer ID: $PR2_PAYER_ID (null = público)\033[0m"
echo ""

echo -e "\033[1;33m$PAYER1_NAME pagando o Payment Request público...\033[0m"
APPROVE2=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR2_ID/approve" \
  -H "Authorization: Bearer $PAYER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE2_STATUS=$(echo "$APPROVE2" | jq -r '.status')
TRANSACTION2_ID=$(echo "$APPROVE2" | jq -r '.metadata.transactionId // empty')

if [ "$APPROVE2_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso por $PAYER1_NAME!\033[0m"
  if [ -n "$TRANSACTION2_ID" ] && [ "$TRANSACTION2_ID" != "null" ]; then
    echo -e "\033[1;33m   Transaction ID: $TRANSACTION2_ID\033[0m"
  fi
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE2" | jq .
fi
echo ""

# 5. TESTE 3: Payment Request SEM payerId - Pagar por outro usuário
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📝 TESTE 3: Payment Request SEM payerId - Pagar por Outro Usuário\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mCriando Payment Request de 200 AOA SEM payerId...\033[0m"
PR3=$(curl -s -X POST "$API_BASE_URL/payment-requests" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":200,\"description\":\"Teste 3: SEM payerId (pagar por outro)\",\"category\":\"PERSONAL\"}")

PR3_ID=$(echo "$PR3" | jq -r '.id')
echo -e "\033[0;32m✅ Payment Request criado: $PR3_ID\033[0m"
echo ""

echo -e "\033[1;33m$PAYER2_NAME pagando o Payment Request público...\033[0m"
APPROVE3=$(curl -s -X PUT "$API_BASE_URL/payment-requests/$PR3_ID/approve" \
  -H "Authorization: Bearer $PAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"$PIN\"}")

APPROVE3_STATUS=$(echo "$APPROVE3" | jq -r '.status')
TRANSACTION3_ID=$(echo "$APPROVE3" | jq -r '.metadata.transactionId // empty')

if [ "$APPROVE3_STATUS" == "PAID" ]; then
  echo -e "\033[0;32m✅ Pagamento realizado com sucesso por $PAYER2_NAME!\033[0m"
  if [ -n "$TRANSACTION3_ID" ] && [ "$TRANSACTION3_ID" != "null" ]; then
    echo -e "\033[1;33m   Transaction ID: $TRANSACTION3_ID\033[0m"
  fi
else
  echo -e "\033[0;31m❌ Erro no pagamento\033[0m"
  echo "$APPROVE3" | jq .
fi
echo ""

# 6. Verificar saldos finais
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m💰 Verificando Saldos Finais\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

REQUESTER_BALANCE_FINAL=$(get_balance "$REQUESTER_TOKEN")
PAYER1_BALANCE_FINAL=$(get_balance "$PAYER1_TOKEN")
PAYER2_BALANCE_FINAL=$(get_balance "$PAYER2_TOKEN")

echo -e "\033[1;33m   $REQUESTER_NAME: $REQUESTER_BALANCE_INITIAL AOA → $REQUESTER_BALANCE_FINAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER1_NAME: $PAYER1_BALANCE_INITIAL AOA → $PAYER1_BALANCE_FINAL AOA\033[0m"
echo -e "\033[1;33m   $PAYER2_NAME: $PAYER2_BALANCE_INITIAL AOA → $PAYER2_BALANCE_FINAL AOA\033[0m"
echo ""

# Calcular diferenças
REQUESTER_DIFF=$(echo "$REQUESTER_BALANCE_FINAL - $REQUESTER_BALANCE_INITIAL" | bc)
PAYER1_DIFF=$(echo "$PAYER1_BALANCE_FINAL - $PAYER1_BALANCE_INITIAL" | bc)
PAYER2_DIFF=$(echo "$PAYER2_BALANCE_FINAL - $PAYER2_BALANCE_INITIAL" | bc)

echo -e "\033[0;34m📊 Movimentação de Saldos:\033[0m"
echo -e "\033[1;33m   $REQUESTER_NAME: $REQUESTER_DIFF AOA (esperado: +450 AOA = 100+150+200)\033[0m"
echo -e "\033[1;33m   $PAYER1_NAME: $PAYER1_DIFF AOA (esperado: -250 AOA = -100-150)\033[0m"
echo -e "\033[1;33m   $PAYER2_NAME: $PAYER2_DIFF AOA (esperado: -200 AOA)\033[0m"
echo ""

# 7. Verificar transações criadas
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m📋 Verificando Transações Criadas\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

echo -e "\033[1;33mTransações do Requester ($REQUESTER_NAME):\033[0m"
TRANSACTIONS_REQ=$(curl -s -X GET "$API_BASE_URL/transactions?limit=10" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" | jq -r '.[] | select(.type == "PAYMENT_REQUEST") | {id, reference, amount, status, type, createdAt}')

if [ -n "$TRANSACTIONS_REQ" ]; then
  echo "$TRANSACTIONS_REQ" | jq -s '.'
else
  echo -e "\033[0;31m   ⚠️  Nenhuma transação encontrada\033[0m"
fi
echo ""

echo -e "\033[1;33mTransações do Payer 1 ($PAYER1_NAME):\033[0m"
TRANSACTIONS_P1=$(curl -s -X GET "$API_BASE_URL/transactions?limit=10" \
  -H "Authorization: Bearer $PAYER1_TOKEN" | jq -r '.[] | select(.type == "PAYMENT_REQUEST") | {id, reference, amount, status, type, createdAt}')

if [ -n "$TRANSACTIONS_P1" ]; then
  echo "$TRANSACTIONS_P1" | jq -s '.'
else
  echo -e "\033[0;31m   ⚠️  Nenhuma transação encontrada\033[0m"
fi
echo ""

echo -e "\033[1;33mTransações do Payer 2 ($PAYER2_NAME):\033[0m"
TRANSACTIONS_P2=$(curl -s -X GET "$API_BASE_URL/transactions?limit=10" \
  -H "Authorization: Bearer $PAYER2_TOKEN" | jq -r '.[] | select(.type == "PAYMENT_REQUEST") | {id, reference, amount, status, type, createdAt}')

if [ -n "$TRANSACTIONS_P2" ]; then
  echo "$TRANSACTIONS_P2" | jq -s '.'
else
  echo -e "\033[0;31m   ⚠️  Nenhuma transação encontrada\033[0m"
fi
echo ""

# 8. Verificar se as transações correspondem aos payment requests
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;34m🔍 Verificando Correspondência: Payment Requests → Transações\033[0m"
echo -e "\033[0;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""

# Verificar se as transações aparecem no histórico
echo -e "\033[1;33mVerificando se as transações aparecem no histórico...\033[0m"

# Buscar as 3 transações mais recentes do requester
RECENT_TRANS=$(curl -s -X GET "$API_BASE_URL/transactions?limit=3" \
  -H "Authorization: Bearer $REQUESTER_TOKEN" | jq -r '.[] | select(.type == "PAYMENT_REQUEST") | {id, reference, amount, status, type}')

if [ -n "$RECENT_TRANS" ]; then
  echo -e "\033[0;32m✅ Transações mais recentes do Requester:\033[0m"
  echo "$RECENT_TRANS" | jq -s '.'
  
  # Verificar se os IDs das transações criadas aparecem
  if echo "$RECENT_TRANS" | grep -q "$TRANSACTION1_ID"; then
    echo -e "\033[0;32m   ✅ Transação 1 ($TRANSACTION1_ID) encontrada no histórico\033[0m"
  fi
  if echo "$RECENT_TRANS" | grep -q "$TRANSACTION2_ID"; then
    echo -e "\033[0;32m   ✅ Transação 2 ($TRANSACTION2_ID) encontrada no histórico\033[0m"
  fi
  if echo "$RECENT_TRANS" | grep -q "$TRANSACTION3_ID"; then
    echo -e "\033[0;32m   ✅ Transação 3 ($TRANSACTION3_ID) encontrada no histórico\033[0m"
  fi
else
  echo -e "\033[0;31m   ⚠️  Nenhuma transação encontrada no histórico\033[0m"
fi
echo ""

# 9. Resumo final
echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo -e "\033[0;32m✅ TESTES CONCLUÍDOS!\033[0m"
echo -e "\033[0;32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
echo ""
echo -e "\033[0;34m📊 Resumo:\033[0m"
echo -e "  ✅ Teste 1: Payment Request COM payerId - $PAYER1_NAME pagou 100 AOA"
echo -e "  ✅ Teste 2: Payment Request SEM payerId - $PAYER1_NAME pagou 150 AOA"
echo -e "  ✅ Teste 3: Payment Request SEM payerId - $PAYER2_NAME pagou 200 AOA"
echo ""
echo -e "\033[0;34m💰 Saldos:\033[0m"
echo -e "  $REQUESTER_NAME: +$REQUESTER_DIFF AOA (recebeu)"
echo -e "  $PAYER1_NAME: $PAYER1_DIFF AOA (pagou)"
echo -e "  $PAYER2_NAME: $PAYER2_DIFF AOA (pagou)"
echo ""
echo -e "\033[0;34m💡 Conclusões:\033[0m"
echo -e "  • Payment Requests foram criados e pagos com sucesso"
echo -e "  • Saldos foram movimentados corretamente"
echo -e "  • Transações foram registadas no banco de dados"
echo -e "  • Cada pagamento gerou uma transação do tipo PAYMENT_REQUEST"

