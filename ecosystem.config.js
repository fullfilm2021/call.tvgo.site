module.exports = {
  apps: [
    {
      name: 'call-tvgo',
      script: 'server.js',
      cwd: '/www/wwwroot/call.tvgo.site',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      }
    }
  ]
};
