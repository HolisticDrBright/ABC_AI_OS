export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  sessionSecret: process.env.SESSION_SECRET || '',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    webhookUrl: process.env.TWILIO_WEBHOOK_URL || '',
    quietHoursStart: parseInt(process.env.TWILIO_QUIET_HOURS_START || '21', 10),
    quietHoursEnd: parseInt(process.env.TWILIO_QUIET_HOURS_END || '8', 10),
  },

  apollo: {
    apiKey: process.env.APOLLO_API_KEY || '',
    enrichmentTtlDays: parseInt(process.env.APOLLO_ENRICHMENT_TTL_DAYS || '30', 10),
    monthlyCreditAlert: parseInt(process.env.APOLLO_MONTHLY_CREDIT_ALERT_THRESHOLD || '1000', 10),
  },

  followUpBoss: {
    apiKey: process.env.FUB_API_KEY || '',
    baseUrl: process.env.FUB_BASE_URL || 'https://api.followupboss.com/v1',
    webhookSecret: process.env.FUB_WEBHOOK_SECRET || '',
  },

  openclaw: {
    apiUrl: process.env.OPENCLAW_API_URL || '',
    apiKey: process.env.OPENCLAW_API_KEY || '',
    timeoutMs: parseInt(process.env.OPENCLAW_TIMEOUT_MS || '600000', 10),
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  calcom: {
    apiKey: process.env.CALCOM_API_KEY || '',
    webhookSecret: process.env.CALCOM_WEBHOOK_SECRET || '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@abc-ai-os.com',
  },

  batchSkipTracing: {
    apiKey: process.env.BATCHSKIPTRACING_API_KEY || '',
  },

  featureFlags: {
    predictiveScoringProvider: process.env.PREDICTIVE_SCORING_PROVIDER || 'none',
    mlsIntegrationEnabled: process.env.MLS_INTEGRATION_ENABLED === 'true',
    voiceEnabled: process.env.VOICE_ENABLED === 'true',
    whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
    propstreamApiReady: process.env.PROPSTREAM_API_READY === 'true',
    propstreamEnabled: process.env.PROPSTREAM_ENABLED === 'true',
  },

  compliance: {
    quietHoursStart: process.env.QUIET_HOURS_START || '21:00',
    quietHoursEnd: process.env.QUIET_HOURS_END || '08:00',
    quietHoursTimezone: process.env.QUIET_HOURS_TIMEZONE || 'America/New_York',
    dncEnforcement: process.env.DNC_ENFORCEMENT !== 'false',
    quietHoursEnforcement: process.env.QUIET_HOURS_ENFORCEMENT !== 'false',
    requireApprovalForBulkSend: process.env.REQUIRE_APPROVAL_FOR_BULK_SEND !== 'false',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  posthog: {
    apiKey: process.env.POSTHOG_API_KEY || '',
  },
};
