# Gestor CupVicson

Sistema de gestión gastronómica multi-sucursal para **VICSON S.A.**  
Permite registrar y analizar ventas diarias (CUP), guías de facturación, reembolsables y refrigerios.

---

## 🏗️ Arquitectura

```
Gestor CupVicson/
├── .github/
│   └── workflows/deploy.yml    ← CI/CD automático con GitHub Actions
├── frontend/                   ← App React + TypeScript
│   ├── src/
│   │   ├── components/         ← Componentes reutilizables
│   │   ├── context/            ← AuthContext (Supabase Auth)
│   │   ├── lib/                ← Helpers de API y formato
│   │   ├── pages/              ← Módulos de la app
│   │   └── types.ts            ← Tipos TypeScript del dominio
│   ├── .env.example            ← Variables de entorno (plantilla)
│   └── package.json
├── scripts/
│   └── etl/                    ← Scripts Python de migración de datos
├── schema_supabase.sql         ← Schema completo de la base de datos
└── rls_policies.sql            ← Políticas de seguridad (RLS)
```

**Stack tecnológico:**
| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | TailwindCSS 3 |
| Backend/BaaS | Supabase (PostgreSQL + Auth + RLS) |
| Gráficas | Recharts |
| Iconos | Lucide React |
| Deploy | Vercel |
| CI/CD | GitHub Actions |

---

## 🚀 Setup Local

### Requisitos
- Node.js 20+
- npm 10+
- Cuenta en [Supabase](https://supabase.com)

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd "Gestor CupVicson"
```

### 2. Configurar variables de entorno

```bash
cd frontend
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:
```env
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Obtenlas en: **Supabase Dashboard → Project Settings → API**

### 3. Instalar dependencias y levantar el servidor

```bash
npm install
npm run dev
```

La app estará disponible en `http://localhost:5173`

---

## 🗄️ Base de Datos (Supabase)

### Crear el schema desde cero

1. En Supabase Dashboard → **SQL Editor**
2. Pegar y ejecutar el contenido de `schema_supabase.sql`
3. Luego ejecutar `rls_policies.sql` para aplicar las políticas de seguridad

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `empresas` | Empresas cliente |
| `sucursales` | Establecimientos de cada empresa |
| `contratos` | Contratos de Uso de Planta (CUP) |
| `cup_diario` | Registro diario de ventas por servicio |
| `guias_fact` | Guías de facturación |
| `guias_detalle` | Líneas de servicios por guía |
| `reembolsables` | Gastos reembolsables por proveedor |
| `servicios` | Catálogo de servicios y precios |
| `user_sucursal` | Relación usuario → sucursal + rol |

### Roles de usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total a todas las sucursales |
| `gerente` | Acceso completo a su sucursal asignada |
| `operador` | Lectura + inserción limitada en su sucursal |

---

## 🔒 Seguridad (RLS)

Las políticas de Row Level Security aseguran que:
- Cada usuario solo puede ver datos de su sucursal (excepto `admin`)
- Los operadores no pueden eliminar registros
- El catálogo de servicios y proveedores es visible para todos los autenticados

Para aplicar RLS: ejecutar `rls_policies.sql` en el SQL Editor de Supabase.

---

## 🚢 Despliegue en Vercel

### Primera vez (manual)

```bash
cd frontend
npm run build
# Subir la carpeta dist/ a Vercel, o conectar el repo directamente
```

### Automático con CI/CD

Cada push a `main` dispara el pipeline de GitHub Actions que:
1. Ejecuta TypeCheck (`tsc --noEmit`)
2. Hace build de producción
3. Despliega automáticamente a Vercel

**Secrets requeridos en GitHub** (`Settings → Secrets → Actions`):

| Secret | Valor |
|--------|-------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `VERCEL_TOKEN` | Token de Vercel (vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | ID de organización en Vercel |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel |

---

## 📦 Scripts ETL de Migración

Los scripts de migración desde Excel están en `scripts/etl/`:

```bash
cd scripts/etl
python etl_migracion.py   # Migración principal desde Excel
python rtl_migration.py   # Migración de registros RTL
```

> ⚠️ Estos scripts son de uso único para la carga inicial de datos históricos.  
> Para una base de datos nueva, úsalos solo si tienes datos en Excel que migrar.

---

## 🛠️ Comandos útiles

```bash
# Desarrollo
npm run dev        # Servidor de desarrollo con hot-reload

# Build
npm run build      # Build de producción (TypeCheck + Vite)
npm run preview    # Preview del build de producción localmente

# TypeCheck manual
npx tsc --noEmit   # Verifica tipos sin compilar
```

---

## 📋 Módulos de la Aplicación

| Ruta | Módulo | Descripción |
|------|--------|-------------|
| `/dashboard` | Dashboard | KPIs, gráficos de ventas vs costos del mes |
| `/cup` | CUP Diario | Registro diario de ventas por servicio |
| `/guias` | Guías de Factura | Gestión de guías y seguimiento de facturas |
| `/refrigerios` | Refrigerios | Registro de refrigerios diarios por producto |
| `/reembolsables` | Reembolsables | Gastos reembolsables con IVA |
| `/admin` | Configuración | Datos maestros (admin y gerente) |

---

## 👥 Contribución

1. Crear una rama desde `main`: `git checkout -b feature/mi-mejora`
2. Hacer cambios y verificar TypeCheck: `npx tsc --noEmit`
3. Push y abrir Pull Request → el CI validará el build automáticamente
4. Hacer merge a `main` → deploy automático a Vercel
