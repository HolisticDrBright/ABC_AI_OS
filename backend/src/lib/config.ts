export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  apollo: {
    apiKey: process.env.APOLLO_API_KEY || '',
  },

  followUpBoss: {
    apiKey: process.env.FUB_API_KEY || '',
    baseUrl: process.env.FUB_BASE_URL || 'https://api.followupboss.com/v1',
  },

  openclaw: {
    apiUrl: process.env.OPENCLAW_API_URL || '',
    apiKey: process.env.OPENCLAW_API_KEY || '',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  compliance: {
    quietHoursStart: process.env.QUIET_HOURS_START || '21:00',
    quietHoursEnd: process.env.QUIET_HOURS_END || '08:00',
    quietHoursTimezone: process.env.QUIET_HOURS_TIMEZONE || 'America/New_York',
  },
};
