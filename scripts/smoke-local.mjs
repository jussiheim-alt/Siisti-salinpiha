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
globalThis.location = { origin: 'http://localhost:5173' }

const { localApi } = await import('../src/local/backend.ts')

const login = await localApi('/api/auth/login', {
  method: 'POST',
  json: { email: 'jussiheim@gmail.com', password: 'vaihda-tama-8' },
})
console.log('login', login.user.email, login.user.role)

const me = await localApi('/api/auth/me')
console.log('me', me.user.name)

const invite = await localApi('/api/invites', {
  method: 'POST',
  json: {
    name: 'Testi Jasen',
    email: 'testi@example.com',
    role: 'member',
    constraints: ['no_heavy'],
  },
})
console.log('invite', invite.invite.email, invite.invite.role)

const token = invite.invite.inviteUrl.split('/kutsu/')[1]
await localApi('/api/auth/logout', { method: 'POST' })

const preview = await localApi(`/api/invites/token/${token}`)
console.log('preview', preview.invite.name)

const accepted = await localApi(`/api/invites/token/${token}/accept`, {
  method: 'POST',
  json: { password: 'jasen-salasana-1' },
})
console.log('accepted', accepted.user.email, accepted.user.role)

const home = await localApi('/api/home')
console.log('home', home.weather.place)

console.log('SMOKE_OK')
