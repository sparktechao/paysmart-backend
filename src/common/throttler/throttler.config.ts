export const throttlerOptions = {
  throttlers: [{
    ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests por janela
  }]
};

export const authThrottlerOptions = {
  throttlers: [{
    ttl: 60000, // 1 minuto
    limit: 5, // 5 tentativas de login por minuto
  }]
};
