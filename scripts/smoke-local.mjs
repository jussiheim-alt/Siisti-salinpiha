const store = Object.create(null)
const mem = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v)
  },
  removeItem: (k) => {
    delete store[k]
  },
}
globalThis.localStorage = mem
globalThis.sessionStorage = mem

const { localApi } = await import('../src/local/backend.ts')

const login = await localApi('/api/auth/login', {
  method: 'POST',
  json: { email: 'admin@siistipiha.local', password: 'admin123' },
})
console.log('login', login.user.email, login.user.role)

const me = await localApi('/api/auth/me')
console.log('me', me.user.name)

const home = await localApi('/api/home')
console.log('home', home.weather.place)

const created = await localApi('/api/pihavuorot', { method: 'POST', json: {} })
console.log('pihavuoro', created.pihavuoro.weekStart, created.pihavuoro.status)

await localApi(`/api/pihavuorot/${created.pihavuoro.id}/publish`, { method: 'POST' })
const chat = await localApi('/api/chat/current')
console.log('chat', chat.chat?.pihavuoroId ? 'ok' : 'none')

try {
  await localApi('/api/auth/login', { method: 'POST', json: { email: 'x', password: 'y' } })
  console.error('expected login failure')
  process.exit(1)
} catch (e) {
  console.log('bad-login', e.message)
}

console.log('SMOKE_OK')
