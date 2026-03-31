---
description: Workflow para pasar de resumen ejecutivo+alcance (post-reunión) a: arquitectura inicial (DB/Docker), épicas+user stories, creación y tagging de issues en Linear (MCP), asignación a agentes especialistas y planificación de sprints/ciclos
---

### INPUT (lo que el usuario te entrega para arrancar)

El workflow **solo arranca** cuando el usuario proporciona:

* `Executive Summary` (resumen ejecutivo post-reunión / Gemini)
* `Scope` (in/out) y objetivos
* Preferencias/constraints (privacidad, local LLMs, compliance, etc.)
* (Opcional) stack técnico si ya está decidido

---

# 0) Pre-flight (obligatorio antes de producir output)

## 0.1 Leer reglas globales

* Lee `gemini.md` y aplica sus reglas (tono, formato, convenciones de repo, etc.).
* Si falta `gemini.md`, **detén el flujo** y pide ese archivo.

## 0.2 Confirmar stack

* Si el usuario NO dio stack:

  * Pregunta por stack mínimo: Front, Back, DB, infra, despliegue, IA (si aplica).
* Si el usuario dio stack:

  * No preguntar; solo reflejarlo en decisiones.

## 0.3 Validación de input

Si falta alguno:

* objetivo
* alcance (in/out)
* usuarios/roles
* fuentes de datos
  Entonces: pedir la mínima info faltante **en una sola tanda**.

---

# 1) Formalización del backlog (Primer entregable)

## 1.1 Crear épicas

* Generar 3–8 épicas máximo.
* Cada épica debe mapear a un outcome (valor) y a un bloque de sistema.

## 1.2 Generar user stories (formato fijo)

Para cada épica, generar user stories en formato:

**Como** [rol]
**Quiero** [acción]
**Para** [beneficio]

### Reglas

* Sin criterios de aceptación todavía (eso es el paso 2).
* Cada story debe ser atómica (una intención).
* Añadir “Notas” solo si afectan a arquitectura/seguridad/performance.

## 1.3 Artefactos en archivos

* Crear un directorio: `docs/user-stories/`
* Cada story en su propio archivo Markdown:

`US-<epic>-<slug>.md`

Contenido mínimo por archivo:

* ID y título
* Epic asociada
* Como / Quiero / Para
* Contexto (2–5 bullets)
* Dependencias (si aplica)
* Open questions (si aplica)

**Stop condition:** no pasar al paso 2 hasta que todas las stories estén escritas en archivos separados.

---

# 2) Criterios de aceptación por story (Segundo entregable)

Para **cada** archivo de user story:

## 2.1 Escribir criterios Gherkin (Given/When/Then)

Requisitos obligatorios por story:

* 1–2 escenarios **Happy Path**
* 2–4 escenarios **Edge Cases** (vacío, límites, grandes volúmenes, formatos raros, nulls, etc.)
* 2–4 escenarios **Errores** (HTTP 4xx/5xx, permisos, schema inválido, timeouts, fallos dependencias)

## 2.2 Reglas estrictas de calidad

* Prohibido: “funciona bien”, “debe funcionar”, “correctamente” sin condiciones.
* Cada Then debe ser verificable:

  * códigos HTTP concretos
  * cambios en estado (`pending/running/completed/failed`)
  * validación contra schema
  * persistencia/lectura de DB
  * logs/auditoría generados
  * mensajes de error normalizados

## 2.3 Actualizar cada `.md`

Añadir sección:

`## Acceptance Criteria (Gherkin)`

con escenarios enumerados.

**Stop condition:** ninguna story se considera lista si no incluye escenarios normales + edge + errores.

---

# 3) Arquitectura inicial y base del proyecto (Tercer entregable)

## 3.1 Detectar huecos técnicos

Revisar las user stories y validar si faltan decisiones mínimas:

* modelo de datos / DB schema
* infra docker / compose
* estructura backend (API, workers, colas si aplica)
* auth/roles si hay usuarios
* observabilidad (runs/logging/metrics)
* pipeline datos (raw/processed)

Si faltan, este paso es obligatorio.

## 3.2 Entregar arquitectura inicial

Generar un documento `docs/architecture/initial-architecture.md` con:

* Componentes (front/back/db/agents/infra)
* Flujo de datos
* Decisiones y trade-offs
* Modelo de datos inicial (tablas principales y relaciones)
* Estrategia Docker (servicios, variables, volúmenes)
* Estrategia despliegue (dev/staging/prod si aplica)
* Riesgos técnicos + mitigaciones

**Stop condition:** arquitectura inicial lista antes de crear issues en Linear.

---

# 4) Preparación para Linear (Cuarto entregable: tagging + estructura)

## 4.1 Definir taxonomía de tags

Antes de crear issues:

* `area:frontend`, `area:backend`, `area:data`, `area:infra`, `area:ai`, `area:product`
* `type:feature`, `type:chore`, `type:spike`, `type:bug`
* `priority:p0/p1/p2`
* `risk:high/med/low` (si aplica)

Guardar en `docs/linear/tags.md`.

## 4.2 Auto-tagging rules

Definir reglas automáticas:

* si story menciona mapa/geodatos → `area:data`, `area:backend`
* si menciona importación Excel/CSV → `area:data`, `area:backend`
* si menciona UI → `area:frontend`
* si menciona agentes/LLM → `area:ai`
* si menciona Docker/DB → `area:infra`

---

# 5) Crear issues en Linear vía MCP (Quinto entregable)

> Usar MCP server de Linear para crear issues.

Para cada user story (`docs/user-stories/*.md`):

* Crear un issue en Linear con:

  * Título
  * Descripción (incluye Como/Quiero/Para + link al .md si aplica)
  * Acceptance Criteria resumidos (link al .md + bullets clave)
  * Tags según reglas del paso 4
  * Relación con épica (Project/Initiative si existe)

Además:

* Crear issues técnicos derivados:

  * `spike:` para estándares/schemas/decisiones abiertas
  * `chore:` para infra (docker, CI, db migrations)

**Stop condition:** todas las stories y spikes están en Linear con tags.

---

# 6) Descubrir “trabajadores” (agentes) y asignar trabajo (Sexto entregable)

## 6.1 Inventario de agentes disponibles

Consultar quiénes son los “trabajadores” disponibles en Antigravity y su skill:

* Frontend agent
* Backend agent
* Data/DB/Infra agent
* AI agent (LangGraph/Ollama)
* Market research/marketing agent
* Writer/documentation agent
  (La lista exacta debe venir de Antigravity; si falta, pedirla.)

## 6.2 Asignación por especialización

Para cada issue:

* Determinar “owner agent” principal según tags (`area:*`)
* Determinar “support agents” solo si necesario (ej. backend+data)
* Asignar en Linear (owner) y añadir watchers/mentions (support)

## 6.3 Reglas

* No asignar agentes innecesarios “por defecto”.
* Si el sprint actual no los necesita (ej. marketing), no se asignan.

**Stop condition:** todos los issues tienen owner asignado.

---

# 7) Planificación de ciclos/sprints en Linear (Séptimo entregable)

## 7.1 Definir estrategia de ciclos

* Duración sugerida: 1–2 semanas (si no se especifica).
* Ordenar issues por dependencias y riesgo.

## 7.2 Crear ciclos y asignar issues

* Ciclo 1: “Base técnica” (DB schema + Docker + scaffolding backend + pipelines mínimos)
* Ciclo 2+: features según prioridad

Regla:

* Un ciclo puede involucrar solo los agentes necesarios.
* Los demás agentes quedan sin carga en ese ciclo.

**Stop condition:** issues ubicados en ciclos y con owners.

---

# OUTPUT FINAL DEL WORKFLOW (lo que debes entregar sí o sí)

1. `docs/user-stories/*.md` (uno por story con Gherkin completo)
2. `docs/architecture/initial-architecture.md`
3. `docs/linear/tags.md`
4. Linear: issues creados + taggeados + asignados + en ciclos

---

# QUALITY GATES (no avanzar si falla)

* No hay stack → preguntar y bloquear creación de arquitectura.
* No hay stories en archivos separados → no escribir criterios.
* No hay criterios Gherkin con edge+errores → no crear issues.
* No hay arquitectura base (DB/Docker) cuando se necesita → no planificar sprints.
* No hay inventario de agentes → no asignar issues.