import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `npm run dev`        → plain http, bound to every interface. Open it on a phone
//                        over the LAN; everything works except the location button.
// `npm run dev:secure` → adds a self-signed cert. Browsers only expose geolocation
//                        on a secure origin, so this is the one where "Use my
//                        location" actually works off localhost. Expect a
//                        certificate warning — it's self-signed, tap through it.
const secure = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [react(), ...(secure ? [basicSsl()] : [])],
  server: {
    port: Number(process.env.PORT) || 5199,
    host: true,
  },
})
