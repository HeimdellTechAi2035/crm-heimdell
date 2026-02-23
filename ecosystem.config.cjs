// ═══════════════════════════════════════════════════════════════
//  Heimdell CRM — PM2 Ecosystem Config
//
//  Usage:
//    pm2 start ecosystem.config.cjs --env production
//    pm2 restart heimdell-api
//    pm2 logs heimdell-api
//    pm2 save
// ═══════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'heimdell-api',
      // Use tsx for TypeScript execution (no build step needed)
      script: 'node_modules/.bin/tsx',
      args: 'apps/api/src/server.ts',
      cwd: __dirname,
      instances: 1, // single instance for t3.micro/small; increase for larger instances
      exec_mode: 'fork',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      autorestart: true,

      // Memory limit — adjust based on instance size (512M for t3.micro, 1G for t3.small)
      max_memory_restart: '768M',

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/heimdell/error.log',
      out_file: '/var/log/heimdell/out.log',
      merge_logs: true,
      log_type: 'json',

      // Watch for file changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', '.git', 'dist', 'logs'],

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
