#!/bin/bash
echo "🌱 Executando seed do banco de dados..."
docker compose exec app npm run prisma:seed
echo "✅ Seed concluído!"

