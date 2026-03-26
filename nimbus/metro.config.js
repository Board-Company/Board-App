// Learn more https://docs.expo.io/guides/customizing-metro
// Free 8081 when the dev server starts (covers `npx react-native start`, not only `npm start`).
if (!process.env.METRO_DONT_FREE_PORT && process.argv.includes('start')) {
  const { execSync } = require('child_process')
  const port = String(process.env.METRO_PORT || 8081)
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim()
    if (out) {
      const pids = [...new Set(out.split('\n').filter(Boolean))]
      console.log(`Freeing Metro port ${port} (stale PIDs: ${pids.join(' ')})`)
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid, 10), 'SIGTERM')
        } catch (_) {}
      }
      try {
        execSync('sleep 0.3', { stdio: 'ignore' })
      } catch (_) {}
      let still
      try {
        still = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim()
      } catch (_) {
        still = ''
      }
      if (still) {
        for (const pid of still.split('\n').filter(Boolean)) {
          try {
            process.kill(parseInt(pid, 10), 'SIGKILL')
          } catch (_) {}
        }
      }
    }
  } catch (_) {
    /* nothing listening or no lsof */
  }
}

const { withTamagui } = require('@tamagui/metro-plugin')
const { getDefaultConfig } = require('@react-native/metro-config')

module.exports = withTamagui(getDefaultConfig(__dirname), {
  config: './tamagui.config.ts',
  components: ['tamagui'],
})