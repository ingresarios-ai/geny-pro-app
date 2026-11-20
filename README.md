# Geny Pro · INGRESARIOS (`geny-pro-app`)

Plataforma SaaS de inteligencia financiera, trading (acciones, futuros y opciones) y alto rendimiento basada en el método **PEDEM**, construida con **Next.js (App Router + TypeScript)** lista para desplegar en **Vercel**, con base de datos y autenticación en **Supabase (`geny-pro-app`)**, integración automática de membresías con **Hotmart** y **Whop**, seguimiento por alumno hacia **GoHighLevel (GHL)** y **Panel de Administración 360°**.

---

## 1. Arquitectura

- **`/` (App del Alumno)**: Los 11 módulos completos (*Inicio*, *Mi Geny*, *Mi Dinero*, *Mi Trading*, *Estrategias de Opciones Black-Scholes*, *Radar de Oportunidades*, *Bitácora Reto 21 con Excel y Clasificación*, *Market Replay con TPO/Volume Profile*, *Mis Metas*, *Mi Mentalidad* y *Mi Progreso*) sincronizados en la nube entre dispositivos.
- **`/login` y `/actualizar-clave`**: Inicio de sesión con **Correo + Contraseña** o **Código / Enlace mágico al correo**. Acceso exclusivo para compradores activos o usuarios dados de alta desde Admin.
- **`/renovar`**: Pantalla para usuarios cuya membresía venció, entró en reembolso o fue cancelada (conservando sus datos intactos para incentivar la renovación en Whop o Hotmart).
- **`/admin` (Panel Admin)**:
  - **Tablero Ejecutivo (`/admin`)**: KPIs de negocio, retención semanal, alumnos en riesgo (+5 días sin entrar), graduados del Reto 21, embudo de etapas y consumo de Geny IA.
  - **Alumnos y Membresías (`/admin/alumnos`)**: Buscador, filtros por pasarela/etapa/estado, alta manual individual, carga masiva CSV y exportación a Excel/CSV.
  - **Expediente 360° (`/admin/alumnos/[id]`)**: Seguimiento 1-a-1 de cada alumno (diagnóstico, PEDEM, bitácora, reglas rotas del Reto 21, metas, hitos enviados a GHL y notas privadas de mentoría).
  - **Pasarelas, GHL e IA (`/admin/integraciones`)**: Control total del webhook hacia GoHighLevel, llaves de Hotmart/Whop, simulador de eventos y auditoría de webhooks con reintentos.

---

## 2. Base de Datos Supabase Ya Aprovisionada

- **Organización**: `Ingresarios`
- **Proyecto**: `geny-pro-app` (`jlwrhdlkffxqnwphtrzh`, región `us-east-1`)
- **URL**: `https://jlwrhdlkffxqnwphtrzh.supabase.co`
- **Super Admin inicial pre-autorizado**: `ingresariostech@gmail.com` (puedes entrar en `/login` usando *"Código / enlace al correo"*, crear tu contraseña en `/actualizar-clave`, y desde `/admin/alumnos` agregar cualquier otro administrador o mentor).

---

## 3. Despliegue en Vercel (Paso a Paso)

1. En **Vercel**, haz clic en **Add New → Project** e importa el repositorio privado `ingresarios-ai/geny-pro-app`.
2. En **Environment Variables**, configura las siguientes variables:

| Variable | Dónde obtenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jlwrhdlkffxqnwphtrzh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / Anon Key del proyecto `geny-pro-app` en Supabase (*Project Settings → API*) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Obligatoria en Vercel**: *Secret / service_role key* en Supabase (*Project Settings → API*) para creación automática de cuentas desde Hotmart/Whop y Admin |
| `NEXT_PUBLIC_APP_URL` | **Opcional**: Vercel detecta automáticamente tu dominio (`*.vercel.app` o dominio propio). Defínela solo si deseas forzar una URL fija sin `/` al final |
| `GEMINI_API_KEY` | Tu llave de Google AI Studio / Gemini para el chat de **Mi Geny** (basta configurar esta y/o `ANTHROPIC_API_KEY`) |
| `ANTHROPIC_API_KEY` | Tu llave de API de Anthropic (Claude) para **Mi Geny** (puedes alternar entre Gemini y Claude desde `/admin/integraciones`) |
| `FMP_API_KEY` | Tu llave de Financial Modeling Prep para el **Radar** y precios diarios |

3. Haz clic en **Deploy**.
4. En **Supabase Dashboard** (proyecto `geny-pro-app` → *Authentication → URL Configuration*):
   - **Site URL**: Pon tu dominio de producción (ej. `https://genypro.ingresarios.net`).
   - **Redirect URLs**: Agrega:
     - `https://genypro.ingresarios.net/auth/callback`
     - `https://*.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

---

## 4. Conectar Hotmart, Whop y GoHighLevel

Una vez dentro de `/admin/integraciones` con tu cuenta de Administrador:

1. **GoHighLevel (GHL)**:
   - Pega la URL de tu *Inbound Webhook* de GHL, marca **Activar envío automático** y haz clic en **Enviar evento de prueba a GHL** para mapear los campos en tu workflow.
2. **Hotmart**:
   - En Hotmart (*Herramientas → Webhook*), crea un webhook versión `2.0.0` apuntando a `https://tu-dominio.com/api/webhooks/hotmart` con los eventos de compra aprobada, atrasada, cancelada, reembolsada y contracargo.
   - Copia tu `Hottok` de Hotmart y guárdalo en `/admin/integraciones`.
3. **Whop**:
   - En Whop (*Developer → Webhooks*), agrega `https://tu-dominio.com/api/webhooks/whop` suscribiendo eventos de membresía y pagos (`membership.went_valid`, `membership.went_invalid`, `payment.succeeded`, `payment.failed`, `payment.refunded`).
   - Copia el `Webhook Secret` (`whsec_...`) y guárdalo en `/admin/integraciones`.

---

## 5. Desarrollo Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abre `http://localhost:3000`.

