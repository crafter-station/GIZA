# GIZA - Plan maestro

Experiencia web educativa en 3D sobre las pirámides de Giza: un tour cinematográfico por las tres pirámides con una interacción central, **la deconstrucción**. La pirámide se separa en los bloques que la forman, que quedan suspendidos en el aire y se pueden explorar, inspeccionar, reordenar y volver a ensamblar.

Este documento recoge **decisiones**, no opciones. Si una decisión se cambia, se cambia aquí primero.

**Idioma y estilo**: este plan es el único archivo en español. Todo lo demás (código, identificadores, documentación, commits y textos de la interfaz) se escribe en **inglés**, y el código **no lleva comentarios** (ni JSDoc). Reglas recogidas en `AGENTS.md`.

**Estado**: ✅ Fases 0 a 8 concluidas · 2026-11-01. El detalle está en §10.

---

## 0. Resumen de decisiones

| Área | Decisión |
| --- | --- |
| Tipo de app | Sitio estático sin backend: HTML prerenderizado (contenido útil sin 3D) + motor 3D en el cliente |
| Lenguaje | TypeScript estricto (TS 6) |
| Framework y build | **SvelteKit 3** + Svelte 5 (runes) sobre Vite 8, `@sveltejs/adapter-static`; pnpm 11 con versiones exactas (`save-exact`) |
| Motor 3D | three.js con **`WebGPURenderer`** (WebGPU, con WebGL2 automático como respaldo) y shaders en **TSL** |
| Postprocesado | `RenderPipeline` nodal de three: `pass`, GTAO (`ao`), `bloom`, `traa`, `godrays` (nativos en r187) y gradación propia en TSL |
| Física | Rapier (`@dimforge/rapier3d-simd-compat`, WASM con SIMD) en un Web Worker, solo para el modo "Derrumbe" |
| Animación de interfaz y coreografía | GSAP 3 (core, SplitText, CustomEase), conducido por el bucle único de la app |
| Scroll del tour | Lenis + línea de tiempo propia y determinista (`t` → cámara, luz y capítulos) |
| UI | Componentes Svelte 5 + Tailwind CSS 4; el motor 3D es TS puro en `src/lib/`, independiente del framework |
| Sol real | `suncalc` (posición del sol en Giza para cualquier fecha y hora) |
| Terreno | Modelo digital de elevación real (Copernicus GLO-30) procesado offline a heightmap |
| Modelado | **Procedural en código** para pirámides, bloques, terreno, templos, mastabas y palmeras; **GLB optimizado** solo para la Esfinge, rocas escaneadas y acacias |
| Texturas | KTX2 (Basis) para el 3D; WebP responsivo para imágenes del DOM |
| Selección de bloques | Picking por GPU (buffer de IDs), no raycast en la CPU |
| Audio | Web Audio API: síntesis + un puñado de bucles CC0 |
| Identidad visual de la UI | Pigmentos de la pintura egipcia como tokens (papiro, tinta, lapislázuli, oro, ocre rojo, fayenza) en `layout.css`; tarjetas de papiro con friso de triángulos y líneas de registro dobles; cartuchos reales con barra *shen*; numerales egipcios (Z15/V20) en capítulos; títulos en Cormorant Garamond, texto en Inter, jeroglíficos en Noto Sans Egyptian Hieroglyphs (todo autoalojado con Fontsource); componentes con Bits UI |
| Jeroglíficos | Glifos Unicode reales (bloque U+13000) con la fuente Noto Sans Egyptian Hieroglyphs; **nunca** jeroglíficos inventados por IA |
| SEO y metadatos | `src/lib/app/site.ts` es la fuente única de título, descripción, canonical, Open Graph, Twitter y JSON-LD; iconos y manifest en `static/metadata/` (el `favicon.ico` se queda en la raíz) y la tarjeta social en `/metadata/og.jpg` (1200 × 630). Dominio de producción `giza.crafter.run`, con `sitemap.xml` prerenderizado desde esa constante |
| Idiomas | **Inglés** (principal y fuente de verdad de los textos) y español como traducción |
| Calidad | 4 niveles (Ultra / Alta / Media / Baja) elegidos con una prueba de rendimiento durante la carga, más resolución adaptativa |
| Calidad de código | Biome 2.6 (lint + formato; Svelte en modo experimental) + `svelte-check`; Vitest 4 (unit en Node y componentes en navegador); Playwright (E2E multi-navegador y regresión visual); **agent-browser** (QA visual guiada por agentes) |
| Despliegue | Vercel (estático, caché inmutable para assets con hash) |

### Por qué WebGPU + TSL y no WebGL + `onBeforeCompile`

- La deconstrucción mueve **decenas de miles de bloques** con estado propio (posición, velocidad, rotación, fase). Eso es trabajo de **compute shaders**: con WebGPU corre por completo en la GPU y la CPU solo escribe unos pocos uniforms.
- En 2026, WebGPU está disponible en Chrome, Edge, Safari y Firefox de escritorio. Cuando no lo está, `WebGPURenderer` cae a WebGL2 con **el mismo código TSL**: un solo lenguaje de shaders para ambos backends.
- TSL se compone como código TypeScript (funciones, reutilización, tipado), sin reemplazar cadenas de `#include` que se rompen entre versiones (uno de los problemas detectados en Seijaku).
- Coste asumido: `onBeforeCompile`, `ShaderMaterial` y pmndrs `postprocessing` **no** se usan. Las técnicas de las skills se traducen a nodos (ver §3).

### Por qué SvelteKit + Svelte 5 y no React + R3F

- El motor necesita un único bucle imperativo, compute, picking por GPU y control fino de la memoria; R3F aporta poco ahí y añade una capa de reconciliación.
- La UI (paneles, inspector, línea de tiempo, menú, hotspots accesibles) sí se beneficia de componentes. Svelte 5 compila a JS mínimo, sus runes conviven bien con un motor externo y el tamaño final es pequeño.
- La frontera es un **store tipado**: la UI emite intenciones (`deconstruct('khufu')`) y lee estado (`phase`, `selectedBlock`), y nunca toca objetos de three.
- SvelteKit (elegido al crear el proyecto) se usa en modo estático: prerenderiza el HTML de cada ruta (contenido accesible y útil si falla WebGPU/WebGL, enlaces profundos como `/khufu`) y el motor arranca solo en el cliente (`onMount`). No hay servidor.
- Particularidades de SvelteKit 3 adoptadas como convención: el alias es `#lib/...` (no existe `$lib`) y los imports llevan extensión `.ts` explícita, para que los mismos módulos se ejecuten en Vite y en las herramientas de Node (`node tools/*.ts`, sin compilar).

### Revisión tecnológica 2026 (hecha en la Fase 0)

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Playwright vs. agent-browser | **Los dos, con papeles distintos**. Playwright es el motor de tests (Vitest browser mode ya lo usa y `@playwright/test` cubre E2E y regresión visual). agent-browser (Vercel Labs) es la herramienta con la que un agente mira la app durante el desarrollo | agent-browser está pensado para agentes: instantáneas con referencias, capturas y consola con muy pocos tokens, y modo `--webgpu`; pero es una CLI centrada en Chrome, sin runner de tests. Playwright prueba Chromium, Firefox y WebKit, imprescindible porque WebGPU difiere entre navegadores |
| Lint y formato | Biome 2.6 | Un solo binario rápido para TS/JS/JSON/CSS; su soporte de Svelte es experimental pero suficiente para esta base de código (la mayor parte es TS del motor). Oxlint solo analiza el `<script>` de los `.svelte` y Oxfmt no es estable en Svelte |
| Física | `rapier3d-simd-compat` 0.21 | La variante SIMD es más rápida y WASM SIMD está disponible en todos los navegadores objetivo |
| Postprocesado | Nodos nativos de three r187 (`GodraysNode`, `TRAANode`, `GTAONode`, `BloomNode`), `SkyMesh`, `CSMShadowNode` | Ya existen para WebGPU; los rayos de sol dejan de ser un desarrollo propio |
| `suncalc` | v2.1 | **Cambio de unidades**: devuelve grados y el azimut se mide desde el norte en sentido horario (v1: radianes desde el sur). Documentado en la skill |
| DEM | `geotiff` (Node) en lugar de GDAL + QGIS | Recortar y remuestrear una tesela no requiere instalar GDAL; el script es reproducible y se versiona |
| Despliegue | `adapter-static` en Vercel | Salida estática portable; `adapter-vercel` no aporta nada sin funciones de servidor |

---

## 1. Skills del proyecto y cómo se usan

| Skill | Ubicación | Uso en este proyecto |
| --- | --- | --- |
| `seijaku-cinematic-3d` | `.agents/skills/` (enlazada en `.claude/skills/`) | Tour guiado por scroll, keyframes de cámara, capítulos, modo inspección, carga sin bloqueos, warm-up, culling por regiones, DPR adaptativo, auditoría `?perf`. Incluye `references/webgpu-tsl.md` |
| `open-water-immersive-3d` | `.agents/skills/` (enlazada en `.claude/skills/` en la Fase 0) | Atmósfera, cielo y perspectiva aérea, HDR, partículas en GPU, calidad adaptativa, contrato de salida de color |
| `svelte5-best-practices` | `.agents/skills/` (enlazada; instalada desde `ejirocodes/agent-skills`) | Runes, snippets, componentes y patrones de SvelteKit para la capa de UI |
| `threejs-textures` | `.agents/skills/` (instalada desde `cloudai-x/threejs-skills`) | Espacios de color, KTX2, UV, render targets, memoria de texturas; tiene una sección WebGPU/TSL |
| `threejs-animation` | `.agents/skills/` (misma fuente) | Clips, animación procedural y mezcla; con sección WebGPU/TSL |

Skills globales útiles de Claude Code: `run` (lanzar y probar la app), `claude-in-chrome` (QA visual en el navegador real), `code-review` y `simplify` (revisión por fase), `dataviz` (gráficas de la línea de tiempo de construcción), `find-skills` (buscar skills de GSAP, WebGPU o TSL).

### Traducción de las skills a WebGPU/TSL

Las dos skills extraídas asumen WebGL. Equivalencias que se aplican en todo el proyecto:

| En la skill (WebGL) | En este proyecto (WebGPU/TSL) |
| --- | --- |
| `onBeforeCompile` + reemplazo de chunks | `MeshStandardNodeMaterial` / `MeshPhysicalNodeMaterial` con `colorNode`, `normalNode`, `roughnessNode`, `positionNode`, `emissiveNode` |
| Uniforms compartidos `{ value }` | `uniform()` de TSL compartido entre materiales |
| pmndrs `postprocessing` + N8AO | Postprocesado nodal: `pass(scene, camera)`, nodo de AO, `bloom()`, TRAA, gradación propia en TSL |
| Partículas con fórmula cerrada en el vertex shader | Igual con `positionNode`; si necesitan estado, `instancedArray` + `compute()` |
| `renderer.compileAsync` | Existe también en `WebGPURenderer`; además, `await renderer.init()` antes del primer frame |
| `requestAnimationFrame` propio | `renderer.setAnimationLoop(loop)` como único reloj (obligatorio con WebGPU) |

✅ Hecho en la Fase 0: la tabla completa está en `seijaku-cinematic-3d/references/webgpu-tsl.md` y ambas skills tienen una sección "WebGPU/TSL Route" que la enlaza. `AGENTS.md` (en inglés) recoge skills, convenciones y comandos.

---

## 2. Investigación: lo que la app debe representar con rigor

Las cifras de esta sección se **verificaron en la Fase 0** y viven en `src/lib/data/pyramids.ts` como `Fact` con fuente, estado (`established` / `estimate` / `hypothesis`) y forma de verificación (`checked`). La bibliografía está en `src/lib/content/sources.ts`. La mayoría se verificó con fuentes secundarias que citan la obra primaria (`checked: 'secondary'`); antes de publicar se contrastan con las obras impresas (Lehner, Lehner y Hawass, Verner). Los tests (`pyramids.spec.ts`) comprueban que altura, base y pendiente sean coherentes entre sí. Cada dato visible en la UI llevará su fuente; las reconstrucciones e hipótesis se etiquetan como tales.

### 2.1 Las tres pirámides

| | Keops (Khufu, G1) | Kefrén (Khafra, G2) | Micerinos (Menkaura, G3) |
| --- | --- | --- | --- |
| Lado de la base | ≈ 230,3 m | ≈ 215,3 m | ≈ 102,2 × 104,6 m |
| Altura original | ≈ 146,6 m | ≈ 143,5 m | ≈ 65,5 m |
| Altura actual | ≈ 138,5 m | ≈ 136,4 m | ≈ 61 m |
| Pendiente | 51° 50′ 40″ | 53° 10′ (algunas fuentes: 53° 08′) | 51° 20′ 25″ |
| Volumen aprox. | ≈ 2,6 millones de m³ | ≈ 2,21 millones de m³ | ≈ 0,235 millones de m³ |
| Rasgo visual clave | Escalonada, sin revestimiento; entrada norte y túnel de al-Mamún | Conserva el revestimiento liso cerca de la cima; se asienta ≈10 m más alto, por eso **parece** la más alta | Las 16 hiladas inferiores estaban revestidas de granito rojo de Asuán (parte sin desbastar; hoy quedan 7); gran brecha en la cara norte (intento de demolición del sultán al-Aziz Uthman, 1196) |
| Complejo | 3 pirámides de reinas (G1-a, b, c), fosos de barcas, templo funerario, calzada | Templo del valle, calzada, Gran Esfinge | 3 pirámides de reinas (G3-a, b, c), templos |

Datos de Keops que alimentan la experiencia:

- **≈ 2,3 millones de bloques** (estimación, no un conteo) con una media de ≈ 2,5 t, aunque varían mucho. Masa total ≈ 6 millones de toneladas.
- Unas **203 hiladas** visibles hoy; la altura de las hiladas **no** disminuye de forma regular: oscila entre ≈ 1,5 m abajo y ≈ 0,55 m arriba, con saltos.
- Orientada a los puntos cardinales con un error medio de solo **3′ 38″** (minutos de arco); base casi perfectamente cuadrada y nivelada.
- Las caras son **ligeramente cóncavas** (8 caras en lugar de 4): se aprecia desde el aire con luz rasante, sobre todo en los equinoccios.
- **Sin sombra a mediodía** durante buena parte del año: la pendiente es de 51,84° y, en Giza (29,98° N), la elevación del sol a mediodía la supera **del 28 de febrero al 13 de octubre** (calculado con `suncalc` para 2026, ±1 día según el año; lo comprueba un test). En invierno la cara norte queda entera en sombra a mediodía. Para Kefrén (53,17°) la ventana va del 3 de marzo al 10 de octubre.
- Interior: pasaje descendente (26° 26′, ≈ 1,2 × 1,0 m) hasta la cámara subterránea (≈ 27 m bajo la base, 8,4 × 14,1 m), pasaje ascendente, **Gran Galería** (46,68 m de largo y 8,6 m de alto, con falsa bóveda), **Cámara de la Reina** (5,2 × 5,8 m, techo a dos aguas de 6,3 m), **Cámara del Rey** (granito, 10,5 × 5,2 × 5,8 m, techo de 9 losas que suman ≈ 400 t y 5 cámaras de descarga encima) y conductos estrechos.
- **ScanPyramids**: el "Gran Vacío" (≥ 30 m) detectado con muones (Morishima et al., *Nature*, 2017) y el corredor de la cara norte (≈ 9 m, sección ≈ 2 × 2 m) confirmado con endoscopio en 2023 (Procureur et al., *Nature Communications*). Se representa como "detectado, sin acceso".

### 2.2 Materiales (cómo son las rocas)

| Material | Dónde | Aspecto | Fuente |
| --- | --- | --- | --- |
| Caliza local (formación Mokattam, nummulítica) | Núcleo de las tres pirámides; la Esfinge | Ocre amarillento a beige grisáceo; bloques toscos, juntas anchas, erosión diferencial en estratos horizontales; fósiles de nummulites visibles de cerca | Canteras de la propia meseta, al sur de Keops |
| Caliza fina de Tura | Revestimiento original (casi todo desaparecido) | Blanco crema, pulido, juntas finísimas; queda en la cima de Kefrén y en la base de Keops | Canteras de Tura, al otro lado del Nilo; transporte en barco (papiros de Wadi al-Jarf, "Diario de Merer") |
| Granito rosa de Asuán | Cámara del Rey (Keops), revestimiento inferior de Micerinos, templos | Rosa-rojizo moteado de negro (feldespato, cuarzo, biotita); pulido con brillo | Asuán, ≈ 800 km al sur, por el Nilo |
| Mortero de yeso | Juntas | Rosado-grisáceo pálido | Local |
| Basalto | Pavimento del templo funerario de Keops | Gris oscuro casi negro | Widan el-Faras (Fayum) |

### 2.3 Paisaje, luz y color

- Meseta de caliza al borde del desierto occidental; el valle del Nilo, verde, queda al este. La ciudad moderna llega hoy hasta la meseta.
- **Decisión de paisaje**: el mundo base muestra los monumentos **en su estado actual** sobre un paisaje simplificado **sin la ciudad moderna**, con la franja verde del Nilo a lo lejos (rótulo: "paisaje simplificado"). El modo **"Antes"** restaura el revestimiento, las calzadas, los templos, el puerto y la orilla antigua, rotulado como reconstrucción.
- Paleta medida en fotos de referencia en la Fase 0 (valores de partida): arena #D8B98A–#C49A6C, caliza del núcleo #C9A97A con pátina más oscura, revestimiento de Tura #EDE6D6, granito #9E5B4E con motas #2A2522, cielo pálido y polvoriento (no azul saturado), hora dorada ámbar, sombras azuladas por el cielo.
- Sol: la pendiente y la hora generan las sombras triangulares largas del amanecer y el atardecer. El polvo en suspensión da perspectiva aérea: las pirámides lejanas se aclaran y pierden contraste.
- Vegetación real de la zona: palmera datilera (*Phoenix dactylifera*), palmera dum (*Hyphaene thebaica*), acacia del Nilo (*Vachellia nilotica*), tamarisco, sicómoro, papiro y juncos en las orillas. **Sobre la meseta no hay vegetación**: solo en el valle y la orilla.
- Noche: cielo estrellado; hacia el 2560 a. C. la estrella polar era **Thuban** (por la precesión). La alineación de los conductos con estrellas es una **hipótesis** y se presenta así.

### 2.4 Construcción (contenido educativo)

- IV dinastía; reinado de Keops hacia 2589–2566 a. C. (cronología convencional; el radiocarbono de Ramsey et al. 2010 da 2613–2577 a. C.). Heródoto habla de 20 años de obra, pero el **Diario de Merer** muestra caliza de Tura llegando a Giza en el año 26–27 del reinado: la app dice "unos 20–27 años".
- Mano de obra de unas **20 000–30 000 personas en rotación**, alojadas en el poblado de Heit el-Ghurab. **No eran esclavos.**
- Ritmo implícito: 2,3 millones de bloques en ≈ 26 años son ≈ 240 bloques al día, **un bloque cada 2,5 minutos** en jornadas de 10 horas (con 20 años, uno cada 2 minutos). Es un dato muy potente para la línea de tiempo; se muestra como estimación.
- Diario de Merer (hallado en 2013 en Wadi al-Jarf por la misión de Tallet): barcos con ≈ 30 bloques de Tura de 2–3 t cada diez días, de julio a noviembre, aprovechando la crecida.
- Rampas: recta, en zigzag, envolvente o interna. **Todas son hipótesis**; la app las muestra como alternativas rotuladas, sin afirmar ninguna.
- Herramientas: cobre, dolerita, trineos de madera sobre arena humedecida (pintura de Djehutihotep) y cuerdas.

### 2.5 Disposición de la meseta (para colocar el mundo)

Marco local en metros: origen en el centro de Keops, **+x = este, −z = norte**, y = altura sobre el geoide EGM2008 (≈ nivel del mar). Implementado en `src/lib/data/geo.ts` (`toLocal` / `toGeo`, plano tangente; error < 0,1 m en ±4 km). Coordenadas de referencia (infoboxes de Wikipedia, redondeadas al segundo de arco, ≈ ±15 m), contrastadas con los picos del DEM en la Fase 0:

| Elemento | Lat / Lon | Posición local (x, z) | Distancia al pico del DSM |
| --- | --- | --- | --- |
| Keops | 29.97917, 31.13417 | (0, 0) | 54 m |
| Kefrén | 29.97611, 31.13083 | (−322, +339) | 31 m |
| Micerinos | 29.97250, 31.12833 | (−563, +739) | 0 m |
| Gran Esfinge | 29.97528, 31.13750 | (+322, +431) | no verificable (está en una hondonada) |

Las desviaciones están dentro del ruido de un DSM de radar de 30 m para estructuras altas, así que se mantienen las coordenadas de referencia. En la Fase 2 se afinan con una ortofoto.

---

## 3. La interacción estrella: deconstrucción

### 3.1 Lógica de selección (cómo se activa)

1. **Seleccionar** una pirámide: clic o toque sobre ella, o su tarjeta en el capítulo o en el menú. La cámara se desplaza a un encuadre de 3/4 y aparece el panel lateral con los datos y las acciones.
2. Acciones del panel: **Deconstruir**, **Rayos X**, **Construir**, **Sol y sombra**, **Escala** y **Antes / Ahora**.
3. **Deconstruir** se activa con el botón o manteniendo pulsado sobre la pirámide 0,8 s (con un anillo de progreso). La pulsación larga evita activaciones accidentales y resulta física y satisfactoria.
4. Solo **una pirámide** se deconstruye a la vez; las otras se atenúan con niebla. `Escape` o "Reensamblar" vuelven al estado anterior.
5. Con `prefers-reduced-motion`, la deconstrucción se sustituye por un corte en sección con fundidos (misma información, sin vuelo de bloques).

### 3.2 Coreografía (≈ 4 s, GSAP + compute)

1. **Anticipación** (0,6 s): micro-temblor de cámara, polvo que sale de las juntas, las líneas de las hiladas se iluminan levemente con un brillo cálido y suena un retumbo grave.
2. **Intercambio invisible**: en un solo frame, la malla optimizada de la pirámide se sustituye por los bloques instanciados en su posición exacta (mismo material, sin salto visible), oculto tras el polvo.
3. **Despegue en ola**: los bloques se separan **de arriba abajo** (el orden inverso al de construcción), con un retraso según la hilada y algo de ruido, y giran levemente.
4. **Suspensión**: forman una "vista explotada" que **conserva la forma de la pirámide**: expansión radial ×1,5 y separación vertical entre hiladas (efecto acordeón) para que cada hilada se lea. Después flotan con deriva lenta de ruido curl, como en ingravidez.
5. **Revelado del interior** (solo Keops): al abrirse, quedan a la vista la Gran Galería, las cámaras y los conductos, modelados de forma independiente.
6. La cámara retrocede con una curva de GSAP y después el usuario puede orbitar con límites.

### 3.3 Qué se puede hacer con los bloques suspendidos

| Acción | Detalle |
| --- | --- |
| **Explorar** | Al pasar el cursor, el bloque se resalta y aparece una ficha: hilada nº, dimensiones estimadas, masa (densidad de la caliza ≈ 2,3–2,6 t/m³), material y cantera de origen |
| **Campo de fuerza** | Arrastrar con el cursor aparta los bloques (fuerza calculada en compute); al soltar vuelven con un muelle |
| **Extraer** | Clic en un bloque: vuela hacia la cámara y entra en el **Inspector**, con versión de alto detalle, una silueta humana de 1,75 m como escala, rotación libre, datos y la animación de su ruta (cantera → Nilo → meseta en un mini-mapa) |
| **Rayos X por hiladas** | Un deslizador recorre las 203 hiladas: oculta las superiores y muestra el corte y el interior a esa altura |
| **Vista por material** | Colorea los bloques por material u origen (caliza local, Tura, granito de Asuán) con leyenda |
| **Construir** | Línea de tiempo de 20 años: los bloques llegan en orden de construcción desde la cantera; contadores de años, bloques y trabajadores; selector de hipótesis de rampa (rotuladas) |
| **Derrumbe** | Desde un grupo de bloques (el piramidión y las hiladas superiores, ≈ 3 000 bloques en Ultra), la gravedad actúa con física real (Rapier en un worker): caen, chocan entre sí y con el terreno y levantan polvo. El resto sigue flotando |
| **Reensamblar** | Los bloques regresan como imantados, **de abajo arriba** (orden de construcción) y encajan; vuelve el intercambio a la malla optimizada |

### 3.4 Honestidad de escala

Mostrar 2,3 millones de bloques individuales no es viable en tiempo real ni aporta lectura. Decisión:

- **Capa exterior real**: los bloques de las dos filas exteriores de cada hilada se generan uno a uno con la tabla de hiladas real (≈ 140 000 en Ultra, 70 000 en Alta, 30 000 en Media y 12 000 en Baja, agrupando bloques en los niveles bajos).
- **Núcleo representado**: el interior se muestra como "superbloques" (cada uno equivale a N bloques reales) con una textura algo distinta.
- Rótulo permanente en la vista explotada: **"≈ 2,3 millones de bloques estimados · mostrando X (núcleo a escala 1:N)"**.

### 3.5 Arquitectura técnica de los bloques

- **Datos** (`instancedArray`/storage buffers): `homePos`, `size`, `seed`, `course`, `materialId` y `order` (orden de construcción); estado dinámico `pos`, `vel`, `quat`, `angVel` y `phase`.
- **Kernels de compute**: `lift` (muelle críticamente amortiguado hacia el objetivo explotado, con retraso por hilada), `float` (ruido curl y amortiguación), `field` (repulsión del puntero a partir de su rayo), `assemble` (vuelta en orden de construcción con encaje final exacto) y `xray` (visibilidad por hilada). Todos dependen del `dt` del bucle y son independientes de los fps.
- **Render**: un `InstancedMesh` cuyo `positionNode` lee `pos`/`quat` del storage buffer por `instanceIndex`. Las sombras usan el mismo nodo, así que se mueven con el bloque.
- **Geometría del bloque**: caja con aristas achaflanadas (44 triángulos), 4 variantes de proporción y desgaste de aristas en el shader (distancia a las aristas en espacio local que oscurece y altera la normal). A 140 000 instancias son ≈ 6 M de triángulos en Ultra; los niveles inferiores reducen instancias.
- **Picking**: pase de IDs a un render target RGBA8 de 1×1 bajo el cursor (`setViewOffset` + `readRenderTargetPixelsAsync`, una lectura en vuelo como máximo) → índice del bloque en 24 bits. Se eligió RGBA8 en lugar de `R32Uint` porque funciona igual en WebGPU y en el respaldo WebGL2. Funciona con bloques en movimiento, cosa que un raycast en la CPU no puede hacer con eficiencia.
- **Física (Derrumbe)**: Rapier en un Web Worker con cajas dinámicas; las posiciones vuelven en un `Float32Array` transferible y se escriben en el storage buffer. En los demás modos, la física no existe.
- **Respaldo WebGL2**: TSL compila el compute a transform feedback; el nivel de calidad baja automáticamente y "Derrumbe" se limita a 800 cuerpos.

---

## 4. Tecnologías: lista definitiva

### Runtime (dependencias)

| Paquete | Para qué |
| --- | --- |
| `three` | Motor (`three/webgpu`, `three/tsl` y addons) |
| `gsap` | Coreografías, SplitText, CustomEase y timelines de UI (gratuito desde 2025, incluidos los plugins) |
| `lenis` | Normalización y suavizado del scroll del tour |
| `svelte` | Capa de UI |
| `@dimforge/rapier3d-simd-compat` | Física del modo Derrumbe (en un worker) |
| `suncalc` | Posición del sol en Giza (v2: grados, azimut desde el norte) |

Versiones fijadas en la Fase 0 (exactas en `package.json`): `three` 0.187.0, `gsap` 3.15.0, `lenis` 1.3.27, `@dimforge/rapier3d-simd-compat` 0.21.0, `suncalc` 2.1.1, `svelte` 5.57.3, `@sveltejs/kit` 3.1.1, `vite` 8.3.5, `typescript` 6.0.3, `tailwindcss` 4.3.3. **No se actualiza three a mitad de una fase.**

### Desarrollo

`typescript`, `vite`, `@sveltejs/kit`, `@sveltejs/adapter-static`, `svelte-check`, `tailwindcss`, `@biomejs/biome` 2.6.4, `vitest` 4.1 (+ `@vitest/browser-playwright`), `@playwright/test` 1.64.1, `agent-browser` 0.41, `stats-gl` 4.2 (tiempos de GPU, compatible con WebGPU), `lil-gui` 0.21 (depuración, solo en desarrollo), `geotiff` 3.0 (DEM), `@gltf-transform/*` 4.5 (modelos), `@types/three`, `@types/node`. `vite-plugin-glsl` **no** (todo es TSL).

### Herramientas de contenido (fuera del bundle)

| Herramienta | Uso |
| --- | --- |
| Blender (última versión estable) | Ajustes de otros escaneos y exportación GLB; la Esfinge definitiva ya está integrada |
| `@gltf-transform/cli` | `optimize` con meshopt, cuantización, texturas a KTX2 y deduplicación |
| KTX-Software (`toktx`) | Compresión Basis (UASTC para normales, ETC1S para color) |
| `tools/build-terrain.ts` (`geotiff` en Node) | Recortar el DEM Copernicus GLO-30 de Giza y remuestrearlo al marco local → heightmap Uint16 (sustituye a GDAL + QGIS) |
| `InstancedMesh` de three.js | Palmeras, acacias y papiro procedurales sin descarga de GLB |
| Poly Haven (CC0) | Texturas de arena y roca y modelos de rocas escaneadas |

---

## 5. Cómo se crea cada objeto 3D

Principio: **procedural cuando la forma sigue reglas** (geometría arquitectónica, repetición, terreno) y **escaneo o GLB cuando la forma es orgánica e irrepetible** (la Esfinge, rocas sueltas). Todo GLB pasa por `gltf-transform` y KTX2.

| Objeto | Método | Detalle de realismo | Presupuesto (Ultra) |
| --- | --- | --- | --- |
| **Terreno de la meseta** | DEM real (`static/terrain/giza-height.bin`: 257² muestras Uint16 a 32 m en un cuadrado de 8,2 km desplazado al sur) → terreno por tiles con LOD tipo clipmap, en código. Es un **DSM**: incluye las pirámides suavizadas (≈ 35–40 m en lugar de 146 m) y la ciudad; el terreno aplana sus huellas y los monumentos se generan aparte | Detalle procedural encima: macro-variación de color, ondulaciones de arena (normal animada solo en dunas), roca madre expuesta según pendiente, brillo de granos que se apaga con la distancia | ≈ 1 M triángulos visibles |
| **Pirámides (estado intacto/actual)** | Procedural a partir de `data/pyramids.ts` (dimensiones y pendiente) y `data/khufu-courses.json` (alturas de hilada) | Malla escalonada real por hilada; bordes de hilada rotos con ruido; concavidad de las caras de Keops; revestimiento en la cima de Kefrén; granito inferior de Micerinos; huecos y bloques faltantes por semilla; LOD de 3 niveles | 150–300 k triángulos por pirámide cercana |
| **Bloques individuales** | Procedural (§3.5) | Achaflanado, desgaste de aristas, estratos y nummulites de cerca, variación de tono por instancia | ver §3.4 |
| **Bloque del Inspector** | Procedural en el momento: caja subdividida 64×64 por cara con desplazamiento en TSL usando el mismo ruido que su versión instanciada | Grietas, desconchados y textura fósil a escala de mano | 50 k triángulos |
| **Interiores de Keops** | Procedural a partir de planos acotados (pasajes, Gran Galería con falsa bóveda, Cámara del Rey con vigas, sarcófago de granito) | Granito pulido con clearcoat; caliza con hollín; luz de antorchas (pool de luces) | Carga perezosa |
| **Gran Esfinge** | **GLB definitivo**, ya integrado en la Fase 2: escaneo de una maqueta histórica en bronce de 1903 de Bert W. Longworth que representa la Gran Esfinge, The Watt Institution, CC BY 4.0. Optimizado a 118 012 triángulos; se conserva sin sustituirlo. La interfaz identifica su procedencia y no lo presenta como fotogrametría del monumento | Silueta de la maqueta histórica y recinto excavado | 118 k triángulos, 1,4 MB |
| **Pirámides de las reinas, mastabas** | Procedural: las reinas con el mismo generador; las mastabas como `InstancedMesh` de bloques rectangulares con pendiente lateral y variantes | Campo de mastabas al oeste de Keops en rejilla, como el real | Instancias |
| **Templos y calzadas** | Procedural con kit modular (muros, pilares monolíticos de granito, pavimento de basalto) | Ruinas en "Ahora", completos en "Antes" | - |
| **Rocas sueltas y escombros** | **Procedural en código** (icosaedro + cortes de fractura + erosión), `InstancedMesh` por variante | Dispersión por pendiente y escombros en las bases | 6 variantes × 180 triángulos |
| **Palmeras** | Troncos cilíndricos y frondas curvas instanciadas; impostores de canvas a distancia | Balanceo suave en TSL | Instancias + impostores lejanos |
| **Acacias** | Troncos y copas aplanadas instanciados en código | Franja oriental del valle | Instancias |
| **Papiro y juncos** | Tallos y umbelas instanciados con fundido de opacidad | Orilla hipotética del canal en el modo "Antes" | Instancias |
| **Nilo y canal antiguo** | Superficies adaptadas al terreno con color y ondulación en TSL | Nilo esquemático a distancia; canal y puerto hipotéticos en "Antes" | Sin reflector |
| **Barcos, trineos, cuerdas** | Procedural sencillo en código | Escena de construcción | - |
| **Personas (escala)** | Siluetas de baja geometría, sin rostro | Indicador de escala de 1,75 m | - |
| **Cielo** | Atmósfera física nodal (Rayleigh + Mie con aerosol de polvo) + sol de `suncalc` | Bruma de polvo y degradados correctos al amanecer | - |
| **Estrellas** | Catálogo real (Yale BSC, estrellas brillantes) con la precesión al 2560 a. C. | Thuban cerca del polo | Puntos instanciados |

---

## 6. Render y efectos

- **Luz**: un sol direccional con **sombras en cascada** (CSM para WebGPU) cuyo dirección viene de `suncalc`, luz hemisférica (cielo y arena) y un relleno opuesto sin sombra. Entorno PMREM generado desde el cielo y regenerado solo cuando cambia la hora.
- **Exposición narrativa**: tabla `[t, exposición]` (exterior a pleno sol ≈ 0,9 → Gran Galería ≈ 2,2), como en Seijaku.
- **Postprocesado** (orden fijo): escena HDR → AO (`ao`, media resolución) → rayos de sol (`godrays` nativo, media resolución) → bloom (umbral alto: sol, oro, especulares, antorchas) → gradación (calidez por hora, saturación, viñeta) → tonemapping AgX → salida sRGB → grano/dither. Antialiasing con **TRAA** (temporal) en Alta/Ultra y MSAA en Media/Baja.
- **Atmósfera**: niebla de altura con color de polvo ligado al sol; partículas de arena arrastradas a ras de suelo (compute, recicladas alrededor de la cámara); motas de polvo en los haces de luz de los interiores; distorsión por calor en el horizonte a mediodía.
- **Noche**: luna, estrellas, antorchas en el pool de luces y exposición abierta sin aplastar los negros.

---

## 7. Tour narrativo

El scroll es la línea de tiempo (`t`); todo se deriva de `t` (cámara, luz, capítulos, carga perezosa). Además del scroll: botones Anterior/Siguiente, teclado (←, →, espacio), menú de capítulos y enlaces profundos (`#keops`). Hay modo **Tour** y modo **Exploración libre**.

| # | Capítulo | Contenido | Momento visual |
| --- | --- | --- | --- |
| 0 | Carga | Granos de arena que forman la silueta de las tres pirámides según el progreso real | Partículas en canvas 2D |
| 1 | Amanecer en Giza | Revelado desde las dunas del suroeste con el sol saliendo por el este | Contraluz, rayos de sol, perspectiva aérea |
| 2 | La meseta | Plano de la meseta, alineación diagonal y orientación al norte | Vista cenital que pasa a mapa ilustrado |
| 3 | Keops | Escala (persona, autobús, Estatua de la Libertad), datos | **Deconstrucción** disponible |
| 4 | Dentro de Keops | Rayos X: pasajes, Gran Galería, cámaras, Gran Vacío (muones) | Corte y lluvia de muones visualizada |
| 5 | Kefrén y la Esfinge | El revestimiento que queda, la ilusión de altura | Luz rasante en el revestimiento |
| 6 | Micerinos | El granito rojo, las reinas, la brecha de 1196 | Material de granito de cerca |
| 7 | Construir una pirámide | Canteras, Nilo, Diario de Merer, hipótesis de rampas, línea de tiempo de 20 años | Modo **Construir** |
| 8 | Sol y sombra | Sin sombra a mediodía de febrero a octubre; caras cóncavas en el equinoccio | Deslizador de fecha y hora con sol real |
| 9 | El cielo de 2560 a. C. | Thuban, precesión e hipótesis de los conductos | Noche estrellada |
| 10 | Antes y ahora | Deslizador que restaura el revestimiento blanco de Tura y el paisaje antiguo | Transición de materiales |
| 11 | Explora | Modo libre con todas las acciones | - |

Secciones editoriales (HTML sobre el canvas, como en Seijaku): **materiales** (macro de caliza → Tura → granito → yeso → cobre, con disolución por ruido), **cifras** que cuentan hacia arriba y **fuentes**.

---

## 8. Rendimiento: presupuestos y estrategias

Presupuestos objetivo (hipótesis a medir; los resultados reales se anotan aparte):

| Métrica | Ultra / Alta (escritorio, GPU media tipo RTX 3060 / Apple M1) | Media / Baja (móvil, iPhone 13 / Pixel 7) |
| --- | --- | --- |
| FPS | 60 estables a 1440p | 30–60 |
| Draw calls | < 250 | < 120 |
| Triángulos en la vista explotada | ≤ 7 M | ≤ 1,5 M |
| JS inicial (gzip) | < 350 KB | < 350 KB |
| Descarga antes del primer frame | < 8 MB | < 5 MB |
| Total con todo cargado | < 45 MB | < 25 MB |
| Tareas largas tras el loader | 0 > 50 ms | 0 > 50 ms |

Estrategias (de las skills, ya decididas):

- Un solo bucle (`setAnimationLoop`), que también conduce a GSAP (`gsap.updateRoot`) y a Lenis.
- Arranque troceado con `scheduler.yield`; warm-up de pipelines, texturas y buffers antes de quitar el loader.
- Carga por regiones adelantada a la cámara (interiores, Esfinge, paisaje antiguo, Inspector y física solo cuando se acercan).
- Culling manual por regiones del tour; los interiores, apagados fuera de su capítulo.
- Resolución adaptativa que se bloquea tras ajustarse; nivel de calidad elegido con una prueba de 1,5 s durante la carga.
- Cero asignaciones por frame en el bucle; pool fijo de luces (antorchas).
- Generación procedural pesada (bloques y tablas) en Web Workers o en build (`tools/`), nunca en el hilo principal.
- KTX2 para todas las texturas 3D; mipmaps; anisotropía limitada por nivel.
- `?perf`, `?t=`, `?cam=`, `?tier=` y `?noao` como banderas de QA (de la skill Seijaku).
- Pérdida del dispositivo GPU o del contexto → mensaje y contenido HTML equivalente.

---

## 9. Estructura de carpetas

Adaptada a SvelteKit 3 (creado en la raíz). Los tests unitarios van junto a su módulo (`*.spec.ts`) y los de componentes como `*.svelte.spec.ts`. ✅ = ya existe tras la Fase 0.

```
pyramids/
├── plan.md                        # este plan (único documento en español)
├── AGENTS.md ✅                   # skills, convenciones y comandos para agentes (inglés)
├── README.md ✅
├── package.json · pnpm-lock.yaml · pnpm-workspace.yaml · .npmrc ✅
├── tsconfig.json · vite.config.ts · biome.json · playwright.config.ts ✅
├── .gitattributes ✅              # Git LFS para assets-src/
├── .agents/skills/ ✅             # skills del proyecto (fuente)
├── .claude/skills/ ✅             # enlaces (junctions) a .agents/skills
├── open-water/ · seijaku/         # repos de referencia: solo estudio, ignorados por git y por Vite
├── assets-src/ ✅                 # fuentes pesadas que NO se publican (Git LFS); cada carpeta con README de licencia
│   ├── dem/ ✅                    # recorte Copernicus GLO-30 + vista previa
│   ├── models/ ✅                 # fuente de la Esfinge definitiva; otras fuentes con autor y licencia
│   ├── blender/                   # .blend
│   └── photos/ · illustrations/ · textures/   # ver §11
├── static/                        # se sirve tal cual
│   ├── terrain/ ✅                # giza-height.bin + giza-height.json
│   ├── metadata/ ✅               # iconos PNG, site.webmanifest y og.jpg (pendiente)
│   └── models/ · textures/ · audio/ · images/ · fonts/ · basis/
├── tools/                         # scripts de contenido, ejecutados con `node tools/x.ts`
│   ├── build-terrain.ts ✅        # DEM → heightmap + verificación de monumentos
│   ├── build-courses.ts           # tabla de hiladas → JSON
│   ├── build-blocks.ts            # bloques por pirámide y nivel → binarios
│   ├── optimize-models.ts         # gltf-transform + KTX2
│   └── check-assets.ts            # referencias, rutas relativas, tamaños
├── src/
│   ├── app.html · app.d.ts ✅
│   ├── routes/ ✅                 # +layout.ts (prerender), +layout.svelte, +page.svelte; luego /khufu, /credits…
│   └── lib/
│       ├── app/                   # config, banderas de URL, niveles de calidad, store compartido, bus de eventos
│       ├── engine/                # renderer, loop, post/, picking/, quality/, loading/, perf/
│       ├── world/                 # terrain/, sky/, lighting/, atmosphere/, vegetation/, water/, props/
│       ├── monuments/             # pyramid/, blocks/, interiors/, sphinx/, complex/
│       ├── materials/             # nodos TSL: caliza, Tura, granito, arena, yeso, cobre, oro
│       ├── tsl/                   # funciones TSL compartidas: ruido, hash, triplanar, desgaste
│       ├── interaction/ · physics/ · tour/ · audio/
│       ├── ui/                    # componentes Svelte
│       ├── content/ ✅            # sources.ts ✅; en.json (principal), es.json
│       ├── data/ ✅               # geo.ts ✅, pyramids.ts ✅, terrain.ts ✅; khufu-courses.json, layout.ts
│       └── assets/ ✅             # favicon y SVG importados por componentes
└── tests/
    └── e2e/ ✅                    # Playwright: home ✅; capítulos, deconstrucción, capturas ?t=, perf
```

---

## 10. Fases de construcción

Orden profesional (difiere del orden "suelo → vegetación → árboles → pirámides"):

1. Primero el **esqueleto técnico** y un **spike** que confirme que la deconstrucción es viable; es el mayor riesgo del proyecto y no se deja para el final.
2. Después la **maqueta a escala real** con volúmenes grises: valida composición, cámara y tour antes de invertir en detalle.
3. Después la **luz**: todos los materiales se ajustan bajo la luz definitiva; ajustarlos antes obliga a repetirlos.
4. El **terreno** y las **pirámides** (los protagonistas) antes que la vegetación, que es decorado y está lejos, en el valle.

Cada fase termina con: `pnpm check`, `pnpm lint`, `pnpm test` y `pnpm build` limpios, `?perf` medido y anotado, capturas `?t=` de regresión, revisión visual con agent-browser, revisión con `code-review` y commit.

Leyenda: ✅ concluida · ⬜ pendiente · ⚠️ concluida con observaciones.

### Fase 0 - Fundaciones y datos ✅ (concluida el 2026-11-01)
- ✅ Repo git del proyecto (`main`); `open-water/`, `seijaku/` y `.atl/` ignorados; Git LFS activado para `assets-src/` (`.gitattributes`).
- ✅ SvelteKit 3 + Svelte 5 + Tailwind 4 (proyecto creado por el usuario) pasado a `adapter-static` con prerender; Biome 2.6, Vitest 4, Playwright 1.64 (Chromium instalado; Firefox y WebKit con `pnpm exec playwright install`) y agent-browser; **todas las versiones exactas**; dependencias de runtime instaladas (three, gsap, lenis, Rapier SIMD, suncalc).
- ✅ Revisión tecnológica 2026 (§0): Playwright + agent-browser, Rapier SIMD, nodos nativos de three r187, `suncalc` v2, `geotiff` en lugar de GDAL.
- ✅ `open-water-immersive-3d` enlazada en `.claude/skills/`; sección "WebGPU/TSL Route" en ambas skills y `references/webgpu-tsl.md`; `AGENTS.md` y `README.md` reescritos en inglés.
- ✅ `src/lib/content/sources.ts` (bibliografía + `Fact`) y `src/lib/data/pyramids.ts` con las cifras de §2 verificadas; correcciones aplicadas a este plan (orientación 3′ 38″, 20–27 años de obra, un bloque cada ≈ 2,5 min, granito de Micerinos, ventana sin sombra del 28 feb al 13 oct).
- ✅ DEM procesado: la tesela descargada es la correcta (`Copernicus_DSM_10_N29_00_E031_00`); `tools/build-terrain.ts` genera `static/terrain/giza-height.{bin,json}` y el recorte fuente en `assets-src/dem/`; marco de coordenadas en `src/lib/data/geo.ts`; posiciones contrastadas con los picos del DSM.
- ✅ Esfinge: el primer GLB (estatua romana de Maratón) se descartó; en la Fase 2 se integró el modelo de la Gran Esfinge (maqueta en bronce de 1903, CC BY 4.0).
- ✅ Paleta medida: resuelta en la Fase 3 (capturas reales frente a la paleta de §2.3, con test de regresión). Las imágenes de §11 ya las generó el usuario.
- ✅ 11 tests unitarios (marco geográfico, heightmap, coherencia de cifras, ventana sin sombra calculada con el sol real) y 1 test E2E de la página.
- **Hecho cuando** ✅: `pnpm dev` abre la página base (HTML con datos, sin 3D todavía), los datos tienen fuente y el DEM está en `static/terrain/`.

### Fase 1 - Motor + spike de bloques ✅ (concluida el 2026-11-01)
- ✅ `WebGPURenderer` con respaldo WebGL2 (`?backend=webgl` lo fuerza), `powerPreference: 'high-performance'`, `setAnimationLoop` como único reloj (dt acotado a 50 ms y nunca negativo), pérdida de dispositivo → contenido HTML; store tipado (`svelte/store`) entre motor y UI; banderas `?tier=`, `?backend=`, `?perf`.
- ✅ Niveles de calidad (`src/lib/app/quality.ts`): low 12 000 · medium 30 000 · high 70 000 · ultra 140 000 bloques, con tope de DPR por nivel; el respaldo WebGL2 se limita a "medium". **Benchmark con la escena ya visible**: descarta 30 frames de calentamiento, mide 90 y baja un nivel si la mediana supera 22 ms; repite hasta fijarlo (`data-quality="locked"`). Medir bajo el loader opaco daba resultados falsos porque Chrome no presenta el canvas tapado.
- ✅ Loader con progreso real; generación de bloques en un Web Worker; `compileAsync` antes del primer frame; `scheduler.yield` entre pasos.
- ✅ `?perf`: stats-gl (abajo a la derecha) + mediana/p95/peor frame publicados en `html[data-perf]` para QA automatizada.
- ✅ **Spike**: caja achaflanada de 44 triángulos; capa exterior de 2 filas por hilada sobre las 203 hiladas de Keops (altura de hilada uniforme por ahora; la tabla real llega en la Fase 5); un kernel de compute TSL con estado por bloque (`lift` en `position.w`, muelle críticamente amortiguado, ola de arriba abajo al deconstruir y de abajo arriba al reensamblar, deriva de flotación, encaje exacto al volver); render instanciado leyendo los storage buffers en `positionNode`; picking por GPU con resaltado al pasar y selección al hacer clic.
- ✅ Mediciones (Windows 11, Chrome, 1262×624 CSS px):

| GPU / backend | Nivel | Bloques | Mediana | p95 |
| --- | --- | --- | --- | --- |
| RTX 3050 Laptop · WebGPU | ultra (automático) | 140 000 | 16,7 ms (60 fps, tope vsync) | 17,3 ms |
| RTX 3050 Laptop · WebGL2 | medium | 30 000 | 16,7 ms | 17,0 ms |
| Intel UHD (gen-12lp) · WebGPU | ultra (forzado) | 140 000 | 50 ms | 150–270 ms |
| Intel UHD · WebGPU | high (forzado) | 70 000 | 33 ms | 117 ms |
| Intel UHD · WebGPU | medium (automático) | 30 000 | 16,7 ms | 67 ms |
| Intel UHD · WebGPU | low | 12 000 | 16,7 ms | 50 ms |

- ✅ Conclusión: los conteos de §3.4 se mantienen; el benchmark elige bien el nivel en ambas GPU.
- ⚠️ **En portátiles con dos GPU, Chrome en Windows usa la integrada aunque se pida alto rendimiento** (solo cambia con la configuración de gráficos de Windows o `--force_high_performance_gpu`). No es un fallo de la app: el benchmark lo detecta y baja a "medium". Se tendrá en cuenta en los textos de ayuda.
- ⚠️ Sin móvil real disponible: la Intel UHD en "low/medium" sirve de referencia de gama baja; la medición en móvil queda para la Fase 10. Los picos de p95 en la Intel deben revisarse en la Fase 10 (posible interferencia de la automatización).
- ⚠️ El tiempo de GPU de stats-gl marca 0 con WebGPU en esta máquina (timestamps no disponibles); la mediana de frame es la métrica fiable por ahora.
- GSAP y Lenis se integran en el bucle en la Fase 2, cuando la cámara del tour los necesite.
- ✅ Tests: 22 unitarios (incluyen geometría de 44 triángulos con normales hacia fuera, conteos por nivel ±5 %, envolvente de la pirámide, niveles y banderas) y E2E que arranca, deconstruye y reensambla sin errores de consola (Chromium headless, WebGL2 por software).
- **Hecho cuando** ✅: 60 fps en escritorio con el nivel ajustado y el respaldo WebGL2 funcionando.

### Fase 2 - Maqueta a escala ✅ (concluida el 2026-11-01)
- ✅ Terreno con el DEM real (257² muestras a 32 m) y **plataformas aplanadas** bajo cada pirámide (mediana de un anillo alrededor, fundido de 60 m). Resultado coherente con las fuentes: base de Keops ≈ 60 m, Kefrén ≈ 69 m (los ≈ 10 m más alta), Micerinos ≈ 71 m, Esfinge ≈ 24 m (en su hondonada).
- ✅ Las tres pirámides como volúmenes exactos en su posición con su **altura actual** (troncos de pirámide: Keops 138,5 m sobre una pirámide teórica de 146,6 m). Asunción a verificar en la Fase 5: en Micerinos, 102,2 m va en el eje este-oeste y 104,6 m en el norte-sur.
- ✅ **Esfinge con modelo real** en vez de caja: "The Great Sphinx of Giza" (The Watt Institution, CC BY 4.0), que es el escaneo de una **maqueta en bronce de 1903** de Bert W. Longworth, con el recinto excavado alrededor. Se optimiza con `tools/optimize-models.ts` (1 487 624 → 118 012 triángulos, 19 → 1 malla, sin texturas de bronce, 1,4 MB con meshopt), se escala por su altura real (20 m desde el suelo del recinto) y se orienta sola hacia el este (detecta la cabeza). Se rotula como maqueta histórica. La estatua de Maratón queda descartada.
- ✅ Tour completo de 11 capítulos (`src/lib/tour/chapters.ts`) con textos provisionales en inglés; scroll → `t` con Lenis conducido por el bucle único; GSAP también conducido por el bucle (`gsap.updateRoot`); interpolación Hermite con **tangentes monótonas** (Catmull-Rom se pasaba bajo el suelo); flechas ← →, menú de capítulos, enlaces profundos (`#khufu`) con `goto(..., { shallow, replace })` de SvelteKit 3, `?t=` para capturas; modo **Explorar libremente** con órbita y vuelta animada al tour.
- ✅ Intercambio sencillo volumen ↔ bloques en Keops (los bloques solo se dibujan y calculan mientras están fuera de su sitio o durante el benchmark).
- ✅ UI con **Bits UI** (Select, Toggle, Button, Progress) - decisión del usuario; recogida en `AGENTS.md`.
- ✅ Tests (35): el recorrido de la cámara se muestrea cada 0,002 de `t` y nunca baja de 8 m sobre terreno, pirámides o Esfinge; cada capítulo encuadra su monumento a mitad de capítulo; solo un texto visible a la vez.
- ✅ Revisión visual con agent-browser de los capítulos 1, 2, 3, 5, 6, 9 y 11 (el amanecer se movió al sur para que las tres pirámides no se tapen).
- ✅ Prueba en el navegador real (rehecha): scroll → capítulo, flechas, modo libre y vuelta, enlace profundo y deconstrucción/`Escape`. Destapó un fallo corregido: cambiar el `#capítulo` con la página abierta no movía el tour (ahora se escucha `hashchange`).
- **Hecho cuando** ✅: se recorre todo el tour sin atravesar geometría (test) y cada capítulo encuadra lo que debe (test + capturas).

### Fase 3 - Luz, cielo y atmósfera base ✅ (concluida el 2026-11-01; iniciada por otro agente y completada en esta sesión)
- ✅ Cielo físico `SkyMesh` (Rayleigh + Mie) con **bruma de polvo** propia: el cielo se mezcla hacia el color del aerosol según el momento del día (`haze`), para que el mediodía sea pálido y polvoriento y no azul saturado.
- ✅ Sol y luna reales con `suncalc` v2 (3 de marzo de 2026 en Giza), luz hemisférica, relleno opuesto, **sombras en cascada** (`CSMShadowNode`, 2–3 cascadas según el nivel), PMREM regenerado solo al cambiar la hora (> 0,3 h) o al saltar de capítulo, y niebla de altura integrada analíticamente con color de polvo cálido.
- ✅ Tabla de luz por capítulo (`src/lib/world/atmosphere/lighting.ts`): amanecer → mediodía → tarde (Esfinge, sin contraluz) → atardecer (Micerinos, luz rasante) → noche con luna (cielo de 2560 a. C.) → mediodía. Selector manual (Seguir el recorrido / Amanecer / Mediodía / Atardecer / Noche).
- ✅ Pipeline (`src/lib/engine/render-pipeline.ts`): GTAO a media resolución, rayos de sol (`godrays`) en Alta/Ultra, bloom, TRAA en Alta/Ultra y MSAA ×4 en Media/Baja, gradación (exposición, calidez, saturación, viñeta), AgX y dither. Banderas `?lighting=`, `?noao`, `?cam=x,y,z,tx,ty,tz,fov`.
- ✅ **Paleta medida** en capturas reales (RTX 3050, WebGPU, capítulo 3), mediana de cada región:

| Momento | Arena | Cielo (zénit) | Referencia de arena del plan |
| --- | --- | --- | --- |
| Amanecer | #956E42 (tono 32°, sat. 0,39, lum. 0,42) | #536985 | Ámbar, más oscuro ✅ |
| Mediodía | #BB986B (34°, 0,37, 0,58) | #7C97B5 (sat. 0,28: pálido) | #C49A6C (31°, 0,43, 0,60) ✅ |
| Atardecer | #A6845C (32°, 0,29, 0,51) | #CFD5DA | Cálido ✅ |
| Noche | #231B14 (lum. 0,11) | #252E3E azulado | Oscuro sin negro puro ✅ |

  Antes del ajuste la arena medía saturación 0,19 (gris) por una niebla gris azulada, un relleno de cielo azul y la desaturación de AgX; se corrigió con niebla de polvo cálido, bruma del cielo, gradación de saturación por momento y un albedo de arena algo más saturado (`GROUND_PALETTE`).
- ✅ Regresión automática: `tests/e2e/palette.spec.ts` mide la arena a mediodía (tono 24–42°, sat. > 0,25, lum. 0,45–0,75) y de noche (lum. < 0,2).
- ⚠️ La referencia es la paleta del plan (§2.3), no fotos con licencia: las imágenes del usuario son macros generadas de materiales, no del paisaje. Si se quieren fotos reales del paisaje, `tools/measure-lighting.ts` ya mide cualquier imagen con un manifiesto de regiones.
- **Hecho cuando** ✅: las capturas de amanecer, mediodía, atardecer y noche coinciden con la paleta de referencia (tabla y test).

### Fase 4 - Terreno ✅ (concluida el 2026-11-01)
- ✅ **Terreno por tiles con LOD** (`src/lib/world/terrain/`): 8 × 8 tiles de 1 024 m que cubren todo el DEM, con 4 niveles (128/64/32/16 segmentos, de 8 a 64 m por vértice) elegidos por distancia a la caja del tile, y **faldones** de 24 m que tapan las grietas entre niveles. Las alturas se desplazan **en la GPU**: el DEM aplanado viaja como textura RG de media precisión (altura + peso de plataforma) y una sola geometría por nivel sirve para todos los tiles. La normal se calcula por píxel a partir de la altura, así que la iluminación no cambia al saltar de nivel.
- ✅ **Relieve de dunas idéntico en CPU y GPU** (`relief.ts`): ruido de valor con hash entero (sin seno) escrito en TypeScript y en TSL con la misma aritmética. `createGroundSampler` da la altura exacta del suelo para rocas, Esfinge y cámara; las dunas (±1 m) se amortiguan un 85 % sobre las plataformas de las pirámides.
- ✅ **Material de arena TSL** (`src/lib/materials/ground.ts`): macro-variación de color a 900/180/35 m y vetas alargadas en la dirección del viento (no hay textura que se repita), roca madre con estratos según la pendiente, grava compactada en las plataformas y ondulaciones de viento en la normal que se desvanecen entre 25 y 140 m para no producir aliasing.
- ✅ **Rocas procedurales** (decisión revisada con el usuario): los 6 GLB se sustituyeron por rocas **generadas en código** (`rock-geometry.ts`): icosaedro subdividido + cortes planos (fractura de la caliza en bloques) + erosión con ruido + base plana; tres familias (bloque, canto rodado, losa) y 6 variantes deterministas, **180 triángulos** cada una (antes 1 200), 0 bytes de descarga y sin licencias pendientes. Material procedural de caliza clara. Se dispersan de forma determinista (`rock-scatter.ts`): ≈ 45 % como escombros al pie de las pirámides y el resto por la meseta según la pendiente, fuera de las pirámides y del recinto de la Esfinge; 350 / 900 / 1 600 / 2 400 según el nivel; 6 draw calls instanciados; carga en segundo plano tras el primer frame.
- ✅ Medición: RTX 3050 · WebGPU · ultra con terreno, rocas, 140 000 bloques y el pipeline de la Fase 3 → mediana 16,7 ms (60 fps), p95 16,9 ms.
- ✅ Tests (56): geometría de tiles (conteos, faldón cerrado, caras hacia arriba y faldones hacia fuera), selección de LOD, dunas acotadas y continuas, dispersión (conteo por nivel, exclusiones, escombros en las bases, determinismo); el recorrido de cámara usa ya el suelo con dunas. E2E en Chromium pasa (lento en render por software con el pipeline completo: 2,2 min).
- ✅ Paleta de arena reajustada con la luz de la Fase 3 (`GROUND_PALETTE`: #DDB47C / #C7915A) y medida en pantalla: #BB986B a mediodía frente a la referencia #C49A6C.
- ✅ **Horizonte**: anillo de terreno de 24 km alrededor del DEM (`createHorizonGeometry`, celdas de 128 → 512 → 2 048 m, ≈ 26 000 triángulos, 1 draw call) con el **mismo material**: fuera del cuadrado la altura se funde en 2,5 km hacia el nivel regional (desierto ≈ 68 m al oeste con dunas grandes, valle del Nilo ≈ 20 m al este), y la bruma de la Fase 3 lo une con el cielo. Sin borde visible en vista aérea a 900 m. El norte real (tesela N30 E031) sigue siendo una mejora opcional.
- ✅ Solapamiento de UI resuelto con el rediseño: marca arriba a la izquierda, luz arriba a la derecha, panel de bloques a la derecha, capítulo abajo a la izquierda y navegación abajo a la derecha.
- **Hecho cuando** ✅: el suelo no repite (todo es ruido procedural, sin texturas en mosaico) y no se ven bordes entre tiles (faldones + normales por píxel), comprobado en capturas a 300 m y a 1–2 km.

### Fase 5 - Pirámides ✅ (concluida el 2026-11-01)
- ✅ **Generador procedural** (`src/lib/monuments/pyramid/generator.ts`, en un Web Worker): núcleo escalonado hilada a hilada, segmentado en bloques de ≈ 3 m con retranqueos aleatorios, bloques que faltan (más en esquinas y abajo), caras con huella y contrahuella, revestimientos lisos parciales sobre la pendiente original y huecos tallados. Atributos por vértice (`stone`, `along`, `courseV`, `course`) para que el material dibuje juntas reales. LOD de 2 niveles con `THREE.LOD` (detalle cerca; volumen simple a > 1,8 km).
- ✅ **Keops con hiladas medidas**: se importaron los **203 registros** de la Lámina VIII de Petrie (transcripción corregida de R. Birdsall, 2003) en `src/lib/data/khufu-courses.ts`, con su número original, los niveles y espesores NE y SW, la variación entre esquinas y las anotaciones (hiladas 2, 3, 70, 110, 132, 202 y 203). Cada espesor coincide con la diferencia de niveles. Según la fuente, **las hiladas 202 y 203 ya no existen** (Petrie solo midió restos en la esquina NE), así que la Keops actual se construye con las **201 hiladas existentes**, sin escalar: 5 407,9″ = 137,36 m. El perfil reconstruido anterior se eliminó. Se mantienen la concavidad de las caras, los restos de revestimiento de la primera hilada, la **entrada original** (hilada 19) y el **túnel de al-Mamún** (hiladas 6–7).
- ✅ **Kefrén y Micerinos sin hiladas inventadas**: el generador tiene un **modo liso** (caras sobre la pendiente, sin juntas de hilada) para las pirámides cuyas hiladas no tienen transcripción verificada. Kefrén lleva el revestimiento de Tura en su tercio superior. Micerinos lleva el granito de Asuán en la base hasta una altura **estimada** de 8,75 m (7 de 16 hiladas que superaban los 20 m; rotulado como derivado) y la brecha de 1196 tallada con paredes.
- ✅ **Posiciones del GIS** (`tools/build-gis.ts` → `src/lib/data/giza-gis.ts`, servicio *GIZA Vectors for Web* reproyectado a WGS84 y a nuestro marco): Keops, Kefrén, Micerinos y las seis reinas usan los centros de sus huellas medidas. Respecto a las coordenadas redondeadas, Kefrén se movió 14 m al oeste y 19 m al sur, y G1-a y G1-b, 14 m al este.
- ✅ **Reinas sin porcentajes inventados**:
  - G1-a/b/c se muestran con su altura original documentada (30 / 30 / 29,6 m) como **reconstrucción**.
  - G3-a, con su altura actual documentada (25,4 m).
  - G3-b y G3-c, como pirámides escalonadas de 4 plataformas (documentadas), con una altura **estimada** a partir de la pendiente de G3-a (52° 15′).

  Las alturas reconstruidas o estimadas quedan marcadas en `RECONSTRUCTED_HEIGHTS`.
- ✅ **Mastabas del Cementerio Oriental desde el GIS**: las 84 huellas medidas, con su número de Reisner cuando existe (p. ej. «7110 7120», época de Keops), cada una como rectángulo orientado. Su altura es una **hipótesis visual** (≈ 5 m) porque la capa no registra alturas.
- ✅ **Templos, calzadas y Cementerio Occidental desde el plano de Lepsius** (*Situationsplan des Pyramidenfeldes von Giseh*, Digital Giza, foto 80), **georreferenciado** con los centros GIS de Keops y Kefrén (escala 1,42 m/px, rotación −90°; residuo frente a Micerinos y las reinas de 9–15 m; precisión ≈ ± 25 m). Se digitalizaron:
  - el templo funerario y los dos fosos de barcas de Keops, y su calzada bajando por el escarpe;
  - el templo funerario de Kefrén y su calzada;
  - el templo de Micerinos y el tramo de su calzada visible en el plano;
  - la extensión y el módulo de las mastabas del Cementerio Occidental.

  Todo está en `src/lib/monuments/complex/plan-features.ts` con su nota de precisión. El templo funerario de Keops se centró entre su cara este y G1-a, dentro de esa tolerancia. El templo del valle de Kefrén **no aparece** en el plano porque Mariette lo excavó en 1853, así que se sitúa junto a la Esfinge según las fuentes escritas. Las alturas de templos y calzadas son hipótesis visuales.
- ✅ Cada estructura del complejo lleva su origen (`gis`, `plan` o `written`), para que la interfaz pueda distinguir lo documentado de lo reconstruido.
- ✅ **Material de mampostería TSL** (`materials/masonry.ts`): juntas verticales y de lecho, tono por bloque, pátina, polvo en las huellas, caliza de Tura con manchas verticales y granito con moteado y meteorización; doble cara para que los huecos de bloque muestren su techo en sombra (antes se veía el cielo a través).
- ✅ **Detalle según el nivel de calidad**: la distancia a la que cada pirámide pasa a su volumen simple se escala por nivel (low ×0,25, medium ×0,5, high ×0,8, ultra ×1) y se actualiza si el benchmark baja de nivel. Lo destapó el E2E en render por software, pero beneficia a cualquier equipo modesto.
- ✅ E2E: deconstrucción (4,2 min) e iluminación (5–6 min) pasan en Chromium sin GPU; el servidor de prueba tiene 5 min de margen porque el build ya tarda ≈ 1 min 48 s.
- ✅ Medidas: 313 000 triángulos entre las 9 pirámides (Keops 161 000), generados en 373 ms dentro del worker; RTX 3050 en ultra: mediana 16,7 ms (60 fps) en los capítulos de Keops y de la Esfinge.
- ✅ Tests (84 en total): perfil de hiladas frente a los anclajes de Petrie, presupuesto y envolvente de cada pirámide, revestimientos de Kefrén y Micerinos, entrada y túnel de Keops, complejos sin invadir pirámides y recorrido de cámara libre de reinas, templos y mastabas.
- ✅ Revisión visual a 5 m (bloques, juntas y huecos en la base de Keops), a 100–300 m (cara norte de Keops, Kefrén al atardecer, Micerinos) y a ≈ 2 km (vista aérea de toda la meseta).
- **Hecho cuando** ✅: a 5 m, a 100 m y a 2 km cada pirámide se reconoce (capturas revisadas).
-
### Fase 6 — Deconstrucción (la interacción estrella) ✅ (concluida el 2026-11-01)
- ✅ **Bloques desde la misma tabla medida**: la capa exterior sigue las 201 hiladas existentes de Petrie con el mismo retranqueo del núcleo que la malla de Keops, así que el intercambio malla ↔ bloques coincide hilada a hilada.
- ✅ **Honestidad de escala (§3.4)**: el interior se rellena de **superbloques** que agrupan 10 hiladas. Cada uno sabe cuántos bloques reales representa (≈ 1,13 m³ por bloque = 2,6 M m³ / 2,3 M bloques, dato derivado). El panel lo dice («≈ 2,3 millones estimados · N mostrados: la capa exterior bloque a bloque y el núcleo en superbloques de ≈ 73–135 bloques») y la ficha distingue un bloque de un superbloque.
- ✅ **Coreografía**: anticipación de 0,6 s con brillo cálido y sacudida de cámara antes del despegue; ola de arriba abajo; vista explotada; deriva de flotación; reensamblado de abajo arriba.
- ✅ **Explorar**: resaltado al pasar el puntero y ficha con hilada, medidas y volumen.
- ✅ **Rayos X por hiladas**: deslizador (Bits UI, también con teclado) que oculta las hiladas por encima del corte, montada o explotada.
- ✅ **Campo de fuerza**: al arrastrar, el rayo del puntero aparta los bloques flotantes en el kernel de compute y el muelle los devuelve.
- ✅ **Inspector**: el bloque vuela delante de la cámara y gira junto a una figura de 1,75 m; la ficha incluye medidas, volumen, piedra y un esquema de la cantera al sur de la pirámide.
- ✅ **Derrumbe con física real**: Rapier (SIMD) en un Web Worker. Se leen de la GPU las posiciones de los bloques de las hiladas superiores (400 / 1 000 / 2 000 / 3 000 según el nivel, 800 como máximo en WebGL2), caen con impulso hacia fuera y chocan entre sí y con el suelo; el resto sigue flotando. Al reensamblar, el muelle los devuelve desde donde cayeron.
- ✅ **Movimiento reducido**: con `prefers-reduced-motion`, «Deconstruir» muestra un corte por la mitad de las hiladas en lugar de bloques volando.
- ✅ **Criterio de memoria y rendimiento**: 15 ciclos seguidos de deconstruir → seleccionar → inspeccionar → derrumbar → reensamblar en la RTX 3050 en ultra (139 924 bloques). La memoria de GPU queda estable (42 geometrías / 42 texturas tras el estreno inicial, sin crecer) y la mediana sigue en 16,7 ms con el peor frame en 17,6 ms.
- ✅ **Interiores de Keops** (`src/lib/data/khufu-interior.ts`, `src/lib/monuments/interiors/`): pasajes descendente y ascendente, cámara subterránea, Cámara de la Reina, Gran Galería en 7 resaltes, antecámara y Cámara del Rey en granito, situados con el «General summary of the positions inside the Great Pyramid» de Petrie (pulgadas al norte, al este y sobre el pavimento). El Gran Vacío y el corredor norte (ScanPyramids) se dibujan translúcidos y rotulados como **hipótesis de posición**: las fuentes publican tamaño y zona, no coordenadas. Se ven al deconstruir y con los rayos X, que ahora **cortan también la mitad este** (todo lo que queda a más de 7 m al este del eje), porque los pasajes corren de norte a sur a ≈ 7 m al este del centro.
- ✅ **Construir** (`src/lib/data/construction.ts`, `src/lib/ui/ConstructionTools.svelte`): deslizador y botón de reproducción (GSAP, 1 s por año) que levantan las hiladas en orden, **ponderadas por el volumen acumulado** de cada hilada medida (la mitad del volumen está puesta en la hilada 35, a 30 m). Contadores rotulados como **estimación**: año ≈ n de 26, bloques ≈ 2,3 M × fracción, hiladas y altura, y 20 000–30 000 trabajadores. La nota aclara que el ritmo constante es una suposición que ninguna fuente registra.
- ✅ **Hipótesis de rampa** (Bits UI Select): recta, en zigzag, en espiral (Lehner 1997) e interna (Brier y Houdin 2008), cada una rotulada como **hipótesis** con su resumen. Se dibujan como losas esquemáticas (pendiente 1:10, 8 m de ancho, la interna 12 m dentro de las caras y visible a través de la sillería) que crecen con la obra; el panel dice que la pendiente y el ancho son elecciones visuales. Geometría pura y probada en `src/lib/monuments/construction/ramps.ts`.
- ✅ **Vista por origen de la piedra**: corta la mitad este, muestra la envolvente original del **revestimiento de Tura** como un casco translúcido y deja a la vista el **granito de Asuán** de la Cámara del Rey, con una leyenda de tres orígenes con fuentes (caliza local de la cantera sur, caliza de Tura según el Diario de Merer, granito de Asuán a más de 800 km).
- ✅ **E2E** `tests/e2e/construction.spec.ts` (línea de tiempo, rampa, leyenda y reinicio sin errores de consola), además del ciclo de `home.spec.ts`.
- ✅ Polvo saliendo de las juntas en la anticipación y retumbo sonoro: hechos en la Fase 8.
- **Hecho cuando**: deconstruir → explorar → extraer → derrumbar → reensamblar funciona 10 veces seguidas sin fugas de memoria y dentro de presupuesto (✅ medido), y están todas las acciones de §3.3 (✅).

### Fase 7 — Esfinge, entorno y vegetación ✅
- ✅ La Esfinge integrada en la Fase 2 es la **definitiva por decisión del propietario**. Se conserva el modelo y su atribución como escaneo de una maqueta histórica, sin presentarlo como fotogrametría del monumento.
- ✅ Franja fértil oriental adaptada al relieve y cinta esquemática del Nilo; palmeras y acacias procedurales instanciadas, papiro en el modo antiguo e impostores lejanos. Se evita EZ-Tree: a esta distancia las siluetas procedurales requieren menos descargas y permiten niveles de calidad controlados.
- ✅ «Antes / Ahora» usa una transición continua y reversible ligada al recorrido, con control manual accesible de Bits UI y opción de volver a seguir la narración. Aparecen el revestimiento de Tura, recintos de templos, puerto y canal aproximados. La interfaz identifica expresamente los elementos interpretativos.
- ✅ Verificación: `pnpm check` sin errores ni avisos; 15 pruebas focalizadas de posición, línea temporal y cámara; E2E en Chromium del teclado y la reversibilidad; revisión visual WebGPU del valle y la reconstrucción, sin errores de consola.
- **Hecho cuando**: ✅ el modo «Antes / Ahora» funciona como transición continua.

### Fase 8 — Atmósfera viva y sonido ✅ (concluida el 2026-11-01)
- ✅ **Cielo de 2560 a. C.** (`src/lib/data/sky.ts`, `tools/build-stars.ts`, `src/lib/world/atmosphere/stars.ts`): las 2 068 estrellas del *Bright Star Catalogue* (Hoffleit y Warren 1991, en `assets-src/stars/` con su README) más brillantes que la magnitud 5,2 se llevan de J2000 a 2560 a. C. con su movimiento propio y la precesión IAU 2006 (P03, Capitaine y otros 2003). Comprobación: Thuban queda a 0,2° del polo en 2830 a. C. (la literatura da ≈ 10′) y a 1,3° en 2560 a. C.; Polaris baja a 64,8° de declinación. Se dibujan como sprites instanciados con tamaño y color según magnitud y B−V, giradas por la hora sidérea local de la escena y la latitud de Giza, y aparecen con la noche. `pnpm build:stars` regenera los datos.
- ✅ **Calor en el horizonte**: distorsión de pantalla en el pipeline, ponderada por la distancia (700–3 500 m) y por un valor `heat` de cada luz (mediodía 1, ocaso 0,35, amanecer 0,15, noche 0).
- ✅ **Arena arrastrada**: vetas de arena clara que avanzan con el viento del norte sobre el terreno, con rachas de 17 s, en el material del suelo (`src/lib/world/atmosphere/wind.ts` comparte la dirección con las ondulaciones).
- ✅ **Polvo en haces**: motas GPU (compute TSL) en una caja de 70 m alrededor de la cámara, con dispersión hacia delante respecto al sol y mezcla aditiva, de modo que brillan a contraluz y dentro de los rayos (1 500 / 4 000 / 8 000 / 12 000 según el nivel).
- ✅ **Polvo de las juntas** al deconstruir: una ráfaga que sale de las cuatro caras de Keops durante la anticipación (pendiente de la Fase 6).
- ✅ **Antorchas** de noche a lo largo de las tres calzadas, cada 40 m y a ambos lados, con llama parpadeante y hasta 4 luces puntuales que siguen a las antorchas más cercanas a la cámara (ninguna en nivel bajo ni en WebGL2). Es una **ilustración de ambiente**, no un sistema de iluminación documentado. Las luces nunca se ocultan (solo cambia su intensidad) para no recompilar los materiales.
- ✅ **Ambiente sonoro** (`src/lib/audio/soundscape.ts`, Web Audio sin archivos de audio): viento con rachas, siseo de arena cerca del suelo, zumbido de piedra con reverberación cuando se ven los interiores, retumbo en la deconstrucción e impactos del derrumbe detectados al aterrizar los cuerpos de Rapier (`src/lib/physics/landings.ts`, limitados a 3 cada 70 ms). Solo arranca al pulsar el botón de sonido junto al selector de luz (gesto del usuario); está apagado por defecto.
- Retirada la tarjeta «Reconstructing Giza / Then / Now»: la reconstrucción sigue al recorrido sin control manual.
- ✅ **Inicio en «Explorar libremente» con vuelo de dron** (`src/lib/tour/drone.ts`): sin enlace a capítulo (`#…`, `?t=`, `?cam=`), la página abre en modo libre con un vuelo continuo y elevado que entra desde el este sobre el Cementerio Oriental con Keops en primer plano y Kefrén y Micerinos detrás, se acerca planeando y rodea despacio la meseta. El primer gesto sobre el lienzo (arrastrar, clic o rueda) detiene el dron y entrega el control a OrbitControls desde esa vista; con movimiento reducido la toma queda fija. El panel de bloques no aparece mientras vuela.
- ✅ **Indicador de scroll**: al pasar al recorrido guiado aparece un ratón animado (icono `andrsrxn:mouse-down`, MIT, paquete `@iconify-icons/andrsrxn`) abajo en el centro, que se oculta en cuanto el usuario se desplaza.

### Fase 10 — Optimización y QA ⬜
- Matriz de dispositivos (Chrome, Edge, Safari, Firefox; Windows, macOS, iOS, Android); ajuste de niveles; trazas de rendimiento; revisión `code-review` completa.
- **Hecho cuando**: se cumplen los presupuestos de §8 en los dispositivos de referencia, con las mediciones anotadas.
---

## 11. Imágenes que se necesitan

El contenido factual usa **fotos reales con licencia** (Wikimedia Commons, dominio público o CC-BY, con autoría anotada en créditos). Las imágenes generadas con IA solo se usan para texturas macro decorativas e ilustraciones de estilo, nunca como prueba histórica. Los jeroglíficos se escriben con Unicode, no con IA.

| # | Ruta | Tamaño / formato | Uso | Prompt |
| --- | --- | --- | --- | --- |
| 1 | `assets-src/photos/materials/limestone-macro.png` | 2400×1600 | Sección de materiales: caliza del núcleo | "Extreme macro photograph of weathered Egyptian nummulitic limestone block surface from the Giza plateau, visible coin-shaped nummulite fossils, warm ochre and beige tones, fine erosion pits and horizontal sedimentary banding, raking golden-hour sunlight from the left, shallow depth of field, ultra-detailed, natural color, no text, no people" |
| 2 | `assets-src/photos/materials/tura-macro.png` | 2400×1600 | Materiales: caliza de Tura | "Macro photograph of fine white Tura limestone casing stone, smooth hand-polished surface with very fine chisel marks and a hairline joint, creamy white with faint warm patina, soft diffuse daylight, ultra-detailed, natural color, no text" |
| 3 | `assets-src/photos/materials/granite-macro.png` | 2400×1600 | Materiales: granito de Asuán | "Macro photograph of polished pink Aswan granite, coarse crystals of pink feldspar, grey quartz and black biotite, subtle reflections, ancient worked surface with slight wear, soft studio light, ultra-detailed, no text" |
| 4 | `assets-src/photos/materials/gypsum-macro.png` | 2400×1600 | Materiales: mortero de yeso | "Macro photograph of ancient pinkish-grey gypsum mortar between two rough limestone blocks, crumbly texture, small inclusions, warm side light, ultra-detailed, no text" |
| 5 | `assets-src/photos/materials/copper-tool.png` | 2400×1600 | Materiales: herramientas | "Archaeological museum-style photograph of an ancient Egyptian copper chisel resting on sand-colored linen, green patina and worn edges, soft directional light, dark warm background, no text" |
| 6 | `assets-src/illustrations/ramps-hypotheses.png` | 3000×1500, fondo transparente | Capítulo 7: hipótesis de rampas | "Elegant ink line illustration on transparent background, four small side-by-side diagrams of pyramid construction ramp hypotheses: straight ramp, zigzag ramp on one face, spiral ramp wrapping the pyramid, internal ramp; sepia ink, thin precise architectural lines, subtle hatching, no text, no labels, minimal, educational" |
| 7 | `assets-src/illustrations/nile-transport.png` | 3000×1500, fondo transparente | Capítulo 7: transporte por el Nilo | "Fine ink line illustration, ancient Egyptian wooden cargo boat on the Nile carrying a large limestone block, rowers and a steering oar, palm trees on the bank, sepia ink on transparent background, delicate cross-hatching, editorial style, no text" |
| 8 | `assets-src/illustrations/sledge.png` | 2400×1600, fondo transparente | Capítulo 7: trineo sobre arena | "Fine ink line illustration of ancient Egyptian workers pulling a stone block on a wooden sledge with ropes while one worker pours water on the sand in front of it, sepia ink on transparent background, respectful realistic proportions, editorial style, no text" |
| 9 | `assets-src/textures/papyrus-ui.png` | 2048×2048, repetible | Fondo sutil de tarjetas | "Seamless tileable texture of natural papyrus sheet, crossed horizontal and vertical plant fiber strips, warm light beige, even lighting, flat top-down scan, no writing, no symbols" |

✅ Generadas por el usuario (GPT) en PNG dentro de `assets-src/photos/materials/`. El PNG es el **original sin pérdida**: de él salen las variantes responsivas sin recomprimir dos veces. **La conversión la hace el usuario** (WebP + AVIF a 640/960/1600 px en `static/images/`), no los agentes; por eso no existe `tools/build-images.ts`. Al ser imágenes propias no llevan README de licencia. La imagen OG y el preview se capturan desde la propia app en la Fase 11 y van en `static/metadata/og.jpg` (1200 × 630, ruta ya declarada en el `og:image`).

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación decidida |
| --- | --- |
| La deconstrucción no rinde en móvil | Spike en la Fase 1; conteos por nivel; superbloques; respaldo con corte en sección |
| Las APIs de TSL cambian entre versiones de three | Versión fijada por fase; actualizar solo al inicio de una fase, con capturas de regresión |
| El respaldo WebGL2 es más lento en compute | Nivel máximo "Media" en el respaldo; Derrumbe limitado |
| Errores históricos | `sources.ts` obligatorio; hipótesis rotuladas; revisión de los textos antes de publicar |
| Licencia y fidelidad de la Esfinge | Conservar el modelo definitivo de la maqueta histórica (CC BY 4.0); identificar su procedencia en la interfaz y no atribuirle precisión de escaneo del monumento |
| El DEM solo cubre hasta 30° N | Cuadrado desplazado al sur; para ampliar al norte, descargar la tesela N30 E031 y unirla en `build-terrain.ts` |
| Peso de descarga | KTX2, meshopt, carga por regiones, presupuestos de §8 en CI con `check-assets` |

---

## 13. Plan de fidelidad visual y vida del lugar

Este trabajo complementa las fases 8 y 10. Se construye por escalas: el DEM fija la silueta regional; la geometría cercana aporta irregularidad visible; las normales, el color y la rugosidad representan estratos, fisuras finas y arena sin multiplicar polígonos. Las superficies interpretativas se identifican como tales. La Gran Esfinge definitiva no se sustituye.

| Bloque | Entrega | Criterio de aceptación |
| --- | --- | --- |
| **1. Suelo de roca y arena** ✅ | Relieve erosionado de poca profundidad donde aflora la roca, fisuras y estratos en el material TSL; misma altura en CPU y GPU; protección de las plataformas y de la franja del valle | El suelo deja de verse uniforme a escala humana; cámara, rocas y monumentos no flotan ni se hunden; sin textura descargable ni nueva pasada de render |
| **2. Huellas de cantera** ✅ | Cortes y terrazas de extracción en sectores aproximados al sur de Keops y hacia el Campo Central; bloques de descarte y transición al wadi | Siluetas y ubicación contrastadas con la cartografía arqueológica; trazado interpretativo rotulado, sin inventar una planta exacta |
| **3. Piedra construida** 🔄 | Diferenciar caliza local, revestimiento fino de Tura, granito y mampostería con variación a escala de bloque y de detalle; revisar juntas, roturas, cantos y oclusión | Pirámides, templos y mastabas mantienen sus dimensiones y se leen de cerca y de lejos en «Antes» y «Ahora» |
| **4. Vida y movimiento** ✅ | Integrar con la fase 8 en curso: viento, polvo, sombras y pocas aves distantes si aportan escala; evitar duplicar sistemas de partículas | Movimiento sobrio, sin tapar el texto ni crear bucles de animación adicionales; calidad baja y movimiento reducido conservan legibilidad |
| **5. Perfilado y revisión** ✅ | Capturas comparables, WebGPU y respaldo WebGL2, móvil, coste por nivel de calidad y limpieza de recursos | Las mejoras no rompen los presupuestos de §8 ni introducen errores de consola o regresiones de navegación |

Base documental para el bloque 1: [AERA, geología de la Esfinge](https://aeraweb.org/geology-of-the-sphinx/) describe la caliza Mokkatam y las capas de dureza alterna; [Kawae y Kamei, *Geomorphological Aspects at the Giza Plateau*](https://gizamedia.rc.fas.harvard.edu/documents/kawae_jg_120_2011.pdf) documenta fisuras y vaguadas en la formación Maadi al sur y la cantera de Keops al sur de la pirámide; el [Giza Plateau Mapping Project](https://isac.uchicago.edu/sites/oi.uchicago.edu/files/uploads/shared/docs/Publications/Annual-Reports/2016-2017/AR-2016-2017-Giza-Plateau-Mapping.pdf) registra estratos, cortes y zonas de cantera. Ninguna de estas fuentes proporciona un mapa centimétrico del microrelieve añadido: su forma procedural es una representación visual, no una medición arqueológica.

Bloque 1 implementado: el relieve de hasta 0,38 m se genera con ruido determinista compartido por la CPU y TSL; las plataformas se amortiguan hasta altura intacta y la franja del valle queda fuera de la zona de erosión. La roca horizontal usa una variación de color distinta de los estratos de las paredes, y las fisuras finas y ondulaciones de arena desaparecen con la distancia para evitar patrones repetitivos. No se descargan texturas ni se añaden pasadas o mallas. Verificación: 17 pruebas focalizadas, `pnpm check` limpio, WebGPU y WebGL2 listos sin errores nuevos. En una comparación puntual con otras cargas simultáneas, la mediana WebGPU en nivel bajo fue igual con el efecto activado y desactivado (116,5 ms); no es una medición final de presupuesto, que corresponde al bloque 5.

Bloque 2 implementado (`src/lib/data/quarry.ts`, `src/lib/world/terrain/quarry.ts`, `src/lib/world/props/quarry-rocks.ts`). Base documental: [AERA, *The Great Pyramid Quarry*](https://aeraweb.org/great-pyramid-quarry/) (Lehner, Giza Plateau Mapping Project).
- **Lo documentado** (`KHUFU_QUARRY`, estimación con fuentes):
  - La cantera es una herradura justo al sur de Keops y de la calzada de Kefrén, con los lados alineados con la pirámide.
  - El fondo es irregular y sube hacia el norte; la profundidad máxima es de 30 m y se extrajeron unos 2,76 M m³.
  - Canales anchos aislaban grandes bloques y canales estrechos los dividían en bloques de 1–2 t.
  - Entre la cantera y la Esfinge quedan grandes bloques de roca madre aislados, y uno de 50–100 t sigue desbastado y unido a la roca.
  - La salida sur se pierde bajo un wadi arenado.
- **El trazado** (`QUARRY_TRACE`, rotulado como **hipótesis**):
  - Unas 10 ha entre x = −95 y 225 m, con el borde norte 45 m al sur de la calzada de Kefrén (sin invadir su templo funerario) y una transición de 110 m hacia el wadi.
  - Coincide con el Campo Central y con el escalón de 15–20 m de la pared oeste que ya muestra el DEM de Copernicus.
  - No es una planta medida.
- **Terrazas**: tres bancos rectilíneos de 1,5 m de alto y unos 14 m de ancho bajan desde cada pared, con esquinas en ángulo recto. Primero se probó a cuantizar la altura del DEM, pero dibujaba curvas de nivel, así que se descartó. La misma función se usa en la CPU (cámara, rocas) y en TSL, y se aplica sobre DEM + dunas antes de la erosión para que ambas coincidan.
- **Material**:
  - Las caras de corte se ven como roca clara con estratos a partir de pendientes menores (solo dentro de la cantera).
  - El suelo lleva escombro de caliza y tafla, como describe AERA.
  - Hay canales primarios cada 24 m y secundarios de 3,4 × 2,3 m, solo en parches y desvanecidos con la distancia (300 m y 70 m) para evitar el efecto de cuadrícula.
- **Bloques**:
  - 22 racimos de bloques de descarte de 1–2 t en el fondo y unos 70 semienterrados a lo largo del wadi, que se van espaciando.
  - Prismas achaflanados de roca madre de 9–15 m, la mitad con un escalón desbastado encima, junto a la Esfinge.
  - El monolito desbastado de 4,6 × 3,2 × 2,4 m.
  - Todos usan la caliza existente, sin texturas ni pasadas nuevas.
- **Verificación**: `pnpm check` y Biome limpios; revisión visual con amanecer, mediodía y ocaso desde lejos, sobre la pared oeste y junto a la Esfinge. Sin tests automáticos en esta entrega (a petición del propietario); su coste se medirá en el bloque 5.

### Propuestas para acercarse a la referencia fotográfica (dorada, aérea, con bruma)

La imagen de referencia del propietario (vista aérea al atardecer con bruma dorada, sol velado y relieve nítido) y el estudio de `open-water/` (solo estudio, sin copiar código) apuntan a que la diferencia está sobre todo en **la luz y la atmósfera**, y después en la textura a media distancia. Cada propuesta indica la técnica de Open Water de la que deriva y su coste esperado; son hipótesis por medir en el bloque 5.

| Bloque | Entrega | Criterio de aceptación |
| --- | --- | --- |
| **6. Atmósfera física de polvo** ✅ | Sustituir la niebla exponencial por una atmósfera con LUT al estilo Hillaire 2020 (transmitancia, dispersión múltiple, vista del cielo y perspectiva aérea), como `open-water/src/sky/atmosphere.js`, pero con **aerosol mineral** (lóbulo hacia delante más ancho y albedo cálido), no marino. Composición `L = Lsuperficie · T + Lin-scatter` compartida por cielo, terreno, monumentos y partículas | La bruma dorada aparece por la física del sol bajo, sin teñir materiales a mano; las pirámides lejanas se aclaran y calientan con la distancia; sin bandas; coste medido por nivel |
| **7. Cadena fotográfica HDR** ✅ | Autoexposición por luminancia logarítmica con adaptación temporal y balance de blancos parcial; curva en S suave antes de AgX; bloom en pirámide de mips que conserve la energía, con media de Karis contra destellos; grano fino de película y halo solar suave (aureola) en contraluz; protección contra NaN | Amanecer, mediodía, ocaso y noche se exponen solos sin saltos; el sol velado de la referencia se ve sin quemar el cielo; el texto del DOM no se ve afectado |
| **8. Terreno a media distancia** ✅ | Detalle procedural de dunas de mayor frecuencia (barjanes orientados por el viento del norte) mezclado con el DEM; variación de color a varias escalas que rompa el aspecto borroso a 300–2 000 m; varianza de pendiente convertida en rugosidad (idea LEAN de `water.js`) para que el detalle no desaparezca de golpe | El suelo deja de verse «manchado» desde el dron; sin repetición visible; misma altura en CPU y GPU |
| **9. Piedra de las pirámides** ✅ | Sombreado por hilada medida (sombra y polvo en cada escalón según la normal), oclusión de contacto en juntas, variación de tono por bloque visible desde lejos, desgaste de aristas y del revestimiento de Kefrén; detalle geométrico solo cerca | Desde el dron las caras se leen escalonadas como en la referencia (luz rasante con bandas); de cerca, bloques individuales; sin cambiar dimensiones |
| **10. Cielo y luz rasante** ✅ | Velo alto de cirros o polvo con rayos crepusculares más marcados al amanecer y al ocaso; disco solar velado; sombras de nubes lentas sobre la meseta (mapa de sombra de nubes a baja resolución, como en Open Water) | Los rayos y las sombras de nubes se ven en los capítulos de luz baja sin parpadeo; desactivables en nivel bajo |
| **12. Vida discreta** ✅ | Pocas aves lejanas (milanos planeando) como sprites con animación por vértice; remolinos de polvo ocasionales que reutilizan el sistema de motas; nada de bucles llamativos | Aportan escala sin distraer; se apagan con movimiento reducido y en nivel bajo |
| **13. Sombra de horizonte del terreno** ✅ | Mapa de horizonte precalculado del DEM (una vez, en el worker de terreno) para oscurecer valles y la cantera con el sol bajo más allá del alcance de las cascadas CSM | Al amanecer los wadis y la cantera quedan en sombra a varios kilómetros, como en la referencia; sin coste por fotograma apreciable |
| **14. Deconstruir las tres pirámides** ✅ | Selección de una pirámide objetivo (Keops, Kefrén o Micerinos) para todo el sistema de bloques: deconstruir, rayos X con corte, campo de fuerza, Inspector, derrumbe, construir con rampas y vista por origen. Ver el diseño debajo | Las tres pirámides se pueden deconstruir y reensamblar sin fugas de memoria ni pérdida de rendimiento; las cifras de Kefrén y Micerinos que no estén medidas se rotulan como estimación; Keops se sigue viendo y comportando igual |
| **15. Anotaciones (hotspots) con vuelo de cámara** ✅ | Puntos de interés numerados sobre la Esfinge, las pirámides y otros objetos; al pulsar uno, la cámara vuela con una interpolación suave hasta un encuadre configurado y orbita alrededor de ese punto, como las anotaciones de Sketchfab. Ver el diseño debajo | Cada anotación enfoca su objeto en 1–3,5 s sin saltos ni atravesar monumentos; los marcadores siguen al objeto, se atenúan si quedan ocultos y no tapan el texto; todo se puede usar con teclado y lector de pantalla; con movimiento reducido el cambio es un corte con fundido |
| **16. Ciudad de los constructores, templos y estructuras** ✅ | Sillería con hiladas y juntas para templos, mastabas y calzadas; muro del Cuervo; ciudad de Heit el-Ghurab en «Antes»; anotaciones nuevas | Las estructuras mantienen sus dimensiones; lo documentado y lo esquemático se distinguen en los datos y en las anotaciones |

Orden recomendado: 7 → 6 → 9 → 8 → 10 → 13 → 11 → 12, y después el 14 y el 15. El propietario aprobó todos los bloques salvo el 11, que queda fuera; se hacen de uno en uno.

**Diseño del bloque 14 (selección de pirámide).** La forma recomendada es **una sola pirámide activa cada vez**, no las tres a la vez:
- **Por qué solo una**:
  - El campo de bloques de Keops ya ocupa hasta 140 000 instancias, búferes de cómputo, física y picking. Triplicarlo rompería el presupuesto de memoria y de GPU de §8.
  - Además, la explicación educativa funciona mejor con una pirámide en foco.
- **Cómo se elige la pirámide**:
  - En «Explorar libremente», con un clic sobre la pirámide en la escena (el picking ya existe), y también con un selector en el panel de bloques con los tres cartuchos (`ROYAL_NAMES` ya tiene los de Kefrén y Micerinos).
  - En el recorrido guiado, cada capítulo indica su pirámide.
  - Al cambiar de pirámide, si estaba deconstruida se reensambla primero, la cámara se acerca a la nueva y el worker genera su disposición de bloques.
- **Arquitectura**:
  - Un descriptor `BlockTarget` por pirámide: forma, hiladas, posición, interiores, material por origen, línea de tiempo y rampas.
  - Una API `engine.setTarget(id)` y un campo `target` en el estado.
  - El `BlockField`, los interiores, las rampas, el casco de revestimiento y el detector de impactos se crean para el objetivo activo y se liberan al cambiar. Así se elimina el código que hoy está fijado a Keops (`KHUFU_SHAPE`, `khufuVolume`).
- **Datos, sin inventar**:
  - Kefrén y Micerinos no tienen una tabla de hiladas medidas transcrita (decisión de la Fase 5). Sus bloques usarán **hiladas de espesor uniforme rotuladas como esquema**, con la altura y la base documentadas, hasta que el propietario aporte una tabla verificada.
  - En Micerinos, las 16 hiladas de granito (`MENKAURE_GRANITE`) definen su vista por origen.
  - Los interiores (cámaras de Kefrén y de Micerinos) necesitan sus propias fuentes antes de modelarse; mientras tanto, los rayos X mostrarán solo el corte.
  - La línea de tiempo de construcción usará la duración del reinado solo si hay fuente; si no, se ocultan los años y se muestra solo el orden por volumen.

**Diseño del bloque 15 (anotaciones al estilo Sketchfab).**
- **Datos** (`src/lib/data/hotspots.ts`): cada anotación tiene identificador, número de orden, objeto, punto de anclaje en coordenadas del mundo y encuadre de cámara (posición, objetivo, FOV o, en su lugar, distancia y ángulos alrededor del anclaje). El título y el texto en inglés son `Fact` con fuentes. Los anclajes salen de datos existentes, no se inventan:
  - Esfinge: `SPHINX_PLACEMENT`, cabeza y pecho.
  - Keops: entrada original y túnel de al-Mamún (`KHUFU_OPENINGS`), restos del revestimiento, fosos de barcas.
  - Kefrén: revestimiento de Tura en la cima.
  - Micerinos: granito de Asuán y brecha de 1196.
  - Templos, calzadas, cantera y monolito (`QUARRY_TRACE`), mastabas del Cementerio Oriental.
- **Marcadores**: círculos numerados en el DOM con la identidad egipcia (tokens `gold`, `lapis`, `font-display`), situados cada fotograma con la proyección que publica el motor en el estado, sin que la interfaz toque three.js.
  - Si quedan detrás de un monumento o del terreno, se atenúan. La comprobación se hace en la CPU contra volúmenes sencillos (pirámides y altura del terreno), unas 10 veces por segundo.
  - Se ocultan los que están fuera de pantalla o a más de cierta distancia.
- **Vuelo de cámara**: al pulsar un marcador o elegir la anotación en la lista, `engine.focusHotspot(id)` detiene el dron, pasa a modo libre e interpola con GSAP la posición, el objetivo y el FOV.
  - Se usa un arco (interpolación esférica alrededor del objetivo con elevación mínima sobre el terreno) para no atravesar monumentos.
  - Easing `power3.inOut`, con duración proporcional a la distancia y limitada a 1–3,5 s.
  - Al llegar, OrbitControls queda centrado en el anclaje para orbitar y hacer zoom alrededor de él. Cualquier gesto del usuario cancela el vuelo en curso.
  - Con movimiento reducido, el cambio es un corte con fundido.
- **Panel de la anotación**: tarjeta no modal (Bits UI) con número, título, texto, fuentes y botones de anterior y siguiente para recorrer las anotaciones en orden, como la secuencia de Sketchfab, más «Cerrar».
  - También hay una lista HTML de todas las anotaciones accesible con teclado, que es la alternativa a los marcadores 3D exigida por las reglas de accesibilidad.
- **Relación con el resto**: en «Explorar libremente» se muestran todas las anotaciones. En el recorrido guiado, solo las del capítulo actual y sin vuelo automático, para no pelear con el scroll. Con el bloque 14, enfocar una anotación de una pirámide puede ofrecer «Seleccionar para deconstruir».

Bloque 7 implementado (`src/lib/engine/photographic.ts`, conectado en `render-pipeline.ts`):
- **Exposición por medición incidente**, como la de Open Water: la luz que recibiría una tarjeta gris bajo el sol, el cielo y el entorno actuales, sin leer la imagen desde la GPU, así que funciona igual en WebGL2. Compensa como mucho entre ×0,9 y ×1,2 sobre la exposición de cada luz y se adapta en 1,2 s, como el ojo, al cambiar de luz o de capítulo. Se reinicia con la historia temporal.
- **Curva fotográfica en S** en espacio de pantalla tras AgX (pivote 0,42), con un contraste propio de cada luz: amanecer 1,14, mediodía 1,08, ocaso 1,16 y noche 1,04.
- **Aureola del sol velado**: halo radial con corrección de aspecto, apagado por oclusión si un monumento o el terreno tapan el sol (nueve muestras de profundidad alrededor del disco). Su intensidad depende de la luz (amanecer 0,5, ocaso 0,6, mediodía 0,12, noche 0).
- **Destellos de lente**: tres discos muy tenues sobre el eje sol–centro. Son un **recurso fotográfico de estilo**, no un fenómeno de la escena.
- **Grano de película** de luminancia, más fuerte en los medios tonos y animado por fotograma (desactivado en nivel bajo); se mantiene el dither contra bandas.
- Los rayos crepusculares bajan de 0,12 a 0,08 al amanecer y de 0,10 a 0,065 al ocaso.
- **Pendiente para el bloque 6**: con el sol bajo y la cámara a contraluz sigue habiendo un velo claro sobre toda la imagen. Viene de la niebla exponencial de color uniforme y del bloom sobre el cielo brillante, no de esta cadena. Se resolverá con la dispersión física del bloque 6.
- No se implementó el bloom con media de Karis: el `BloomNode` de three no la ofrece y no se ha visto el problema de destellos que resuelve.
- **Verificación**: `pnpm check` y Biome limpios; capturas a mediodía y al ocaso a contraluz en la RTX 3050. Sin tests automáticos, a petición del propietario.

Bloque 6 implementado (`src/lib/world/atmosphere/scattering.ts`, `environment.ts` y la entrada del bloom en `render-pipeline.ts`):
- **Diagnóstico medido antes de cambiar nada.** Con el bloom y los rayos desactivados, el ocaso a contraluz se veía nítido; reactivando solo los rayos seguía nítido. **El velo lo causaba el bloom**: el disco solar del `SkyMesh` tiene una radiancia enorme y el bloom la repartía por media pantalla. La hipótesis previa, que culpaba a la niebla, era incorrecta.
- **Energía limitada a la entrada del bloom**: se recorta a 8 en HDR, que es la idea de la media de Karis de Open Water contra los destellos. El sol conserva su halo sin lavar la escena; vuelven las siluetas a contraluz.
- **Dispersión por polvo mineral**: el color de la bruma ya no es uniforme. Se modula con una función de fase de Henyey–Greenstein de dos lóbulos:
  - lóbulo hacia delante g = 0,65 (85 %) y retrodispersión g = −0,3 (15 %), con una razón respecto a la dispersión isótropa limitada a 5;
  - el 55 % de la bruma depende de la dirección del sol, escalado por la altitud del sol y apagado de noche.
  - Hacia el sol la bruma brilla dorada; de espaldas, el aire es más limpio y el relieve gana contraste.
  - La transmitancia sigue siendo la integral exponencial en altura (escala de 180 m) que ya existía.
  - Los coeficientes son una **aproximación artística declarada** para el polvo del desierto, no una medición de Giza.
- Las motas de polvo reducen su brillo a contraluz (de 2,5 a 1,4), porque al ocaso se veían demasiados puntos.
- **No se hicieron las LUT completas de Hillaire** (transmitancia, dispersión múltiple, vista del cielo y perspectiva aérea). Con la corrección del bloom y la fase direccional se obtiene el aspecto de la referencia sin cuatro pasadas nuevas. Quedan como opción si en el bloque 5 se ven bandas o la transición de luz no convence. El azul a gran distancia ya lo aporta la dispersión de Rayleigh del `SkyMesh`.
- **Verificación**: `pnpm check` y Biome limpios; capturas al ocaso hacia el sol y de espaldas al sol, y a mediodía. Sin tests automáticos, a petición del propietario. La cadena HDR y la atmósfera son las que más acercan el resultado a la referencia con menos riesgo: no cambian geometría ni datos, y su efecto se compara en las mismas capturas `?cam=` antes y después.

Bloque 9 implementado (`src/lib/materials/masonry.ts`, `src/lib/materials/stone-detail.ts`, `masonry-palette.ts`):
- **Diagnóstico**: desde el dron Keops ya usa la malla con las hiladas reales (el LOD cambia a ~1 440 m en nivel alto), pero el tono era aleatorio por bloque y a distancia se leía como ruido de puntos.
- **Tono por hilada**: el tono de cada bloque mezcla un 60 % de azar por bloque y un 40 % por hilada, así que a distancia aparecen estrías horizontales, como en la referencia.
- **Paleta más tostada** (núcleo claro `#cdb284`, oscuro `#94754f`) y mayor rango de tono entre bloques; antes la cara al sol se veía crema lavada. El polvo de los escalones baja del 55 % al 35 % para que se vea la piedra.
- **Desgaste por altura**: los primeros 7 m tienen la abrasión y el polvo de la arena; entre 25 y 130 m aumenta una pátina cálida (`patina`). Es una **aproximación visual**, no una medición.
- **Relieve de piedra picada** sin texturas: la normal se perturba con el gradiente de superficie de Mikkelsen (derivadas de pantalla) sobre ruido a dos escalas. Tiene 5 cm en el núcleo y un cuarto de eso en el revestimiento y el granito, hunde las juntas y se desvanece entre 40 y 220 m, sin coste a distancia ni aliasing.
- **Rugosidad**: las caras horizontales con polvo pasan de 0,9 a 1.
- **No se hizo**: el desgaste geométrico de las aristas, ni la oclusión de contacto específica en las juntas (la cubren el AO de pantalla y el hundimiento del relieve). Quedan para revisar en el bloque 5 si se ven necesarios.
- **Verificación**: `pnpm check` y Biome limpios; capturas desde el dron al amanecer y junto a la cara este de Keops. Sin tests automáticos, a petición del propietario. La prueba de paleta `tests/e2e/palette.spec.ts` puede necesitar recalibrarse por el cambio de tono.

Bloque 8 implementado (`src/lib/world/terrain/ridges.ts`, `relief.ts` y `src/lib/materials/ground.ts`):
- **Causa de las manchas**: la normal se calculaba con un paso de 1,5 m sobre un DEM de 30 m interpolado bilinealmente, y cada celda se veía como una faceta.
- **Normales a dos escalas**: la altura se separa en base (DEM y nivel regional) y detalle (dunas, crestas y cantera). La base se deriva con un paso de 12 m, que suaviza las facetas, y el detalle con 1,5 m, que lo mantiene nítido. La altura total y la de la CPU no cambian, así que la cámara, las rocas y los monumentos siguen apoyados igual.
- **Crestas de duna transversales** al viento del norte:
  - longitud de onda de 44 m y hasta 1,6 m de alto, con perfil asimétrico: barlovento suave en el 78 % y cara de avalancha abrupta en el 22 %;
  - crestas curvadas hasta 58 m y partidas en tramos (escalas de 48 m y 160 m), en campos de unos 170 m;
  - fuera de las plataformas, la cantera y el valle, y al 55 % dentro de la zona de roca de la meseta.
  - Se calculan igual en la CPU y en TSL. Es una forma procedural, no una medición de las dunas reales.
- **Color a escala media**: las caras a sotavento son más oscuras y rojizas (`leeSand`), con hasta un 35 % de mezcla, y hay parches de *serir* (pavimento de grava) de unos 120 m con hasta un 40 % de mezcla.
- **Pendiente**: el shader del suelo es más pesado (dos gradientes y la función de crestas). Al cargar se nota una compilación más larga, que hay que medir en el bloque 5. A ras de suelo en el desierto, con el sol bajo, se ven un par de sombras alargadas sin identificar; se revisarán con el bloque 13.
- **Verificación**: `pnpm check` y Biome limpios; capturas desde el dron al amanecer y a ras del desierto al ocaso. Sin tests automáticos, a petición del propietario.

Bloque 10 implementado (`src/lib/world/atmosphere/clouds.ts`, integrado en `environment.ts`, `ground.ts` y `masonry.ts`):
- **Un único campo de nubes compartido**: una capa alta de cirros o velo de polvo a 6 km, con ruido alargado según el viento del norte (escalas de 5,2 km a lo largo del viento y 1,3 km de través) y que deriva a 9 m/s. Sus uniforms son únicos y los importan todos los materiales.
- **En el cielo**: el rayo de vista se proyecta al plano de las nubes. Su luz se calibra con la radiancia del propio cielo en ese píxel (×1,35) más un brillo hacia el sol teñido con el color del polvo; la opacidad es del 75 %, se desvanece junto al horizonte y de noche las nubes tapan la mitad del cielo nocturno. Como el cielo del entorno usa el mismo material, los reflejos también llevan nubes.
- **Sombras de nubes**: el mismo campo se proyecta a lo largo de la dirección del sol sobre el suelo y las pirámides (oscurecen hasta un 32 %, escalado por la luz directa), así que las sombras que se mueven coinciden con las nubes visibles.
- **Cobertura por luz**: amanecer 0,34, mediodía 0,18, ocaso 0,40 y noche 0,12. Los rayos crepusculares recuperan parte de su fuerza tras la corrección del bloom: 0,10 al amanecer y 0,085 al ocaso.
- Es una **aproximación visual** de una capa fina, no un modelo volumétrico de nubes: no hay nubes gruesas ni iluminación por dispersión múltiple.
- **Verificación**: `pnpm check` y Biome limpios; capturas al ocaso hacia el sol (cirros y sombra de nube visibles) y desde el dron al amanecer. Sin tests automáticos, a petición del propietario.

Bloque 13 implementado (`src/lib/world/terrain/horizon.ts`, `horizon.worker.ts`, `horizon-shadow.ts`; conectado en `terrain.ts`, `ground.ts` y el motor):
- **Horizonte solo en la dirección del sol**: en vez de precalcular 8 o 16 direcciones e interpolar, un Web Worker calcula para cada celda del DEM (257 × 257, 32 m) la pendiente máxima del terreno hacia el sol, en pasos de 24 m hasta 4 km. Lleva un margen de 0,6 m contra la autosombra del relieve bilineal.
  - Tarda unos 210 ms fuera del hilo principal y solo se repite cuando el azimut del sol cambia más de 1°. La altura del sol no obliga a recalcular, porque se compara en el shader.
  - El resultado se guarda en una textura `R16F` con el mismo mapeo que el mapa de alturas.
- **Solo la luz directa**: el factor se aplica con `receivedShadowNode` del material del suelo, así que oscurece la sombra del sol (CSM) y no la luz ambiental ni la del cielo.
  - La penumbra es suave (±0,025 de pendiente) y el efecto se desvanece en los últimos 300 m del DEM.
  - Los tipos de `@types/three` 0.187 declaran `receivedShadowNode` sin parámetros, aunque three le pasa la sombra; se usa una conversión mínima.
- **Las franjas alargadas del desierto (pendiente del bloque 8)**: no las causa el terreno. Son los volúmenes de sombra de los rayos crepusculares, que usan el mapa de sombra de su propia luz y hacen que las pirámides proyecten franjas sin rayos en la bruma hacia el punto antisolar. Es un fenómeno real y se mantiene.
- **Verificación**: `pnpm check` y Biome limpios; el cálculo se midió en Node (211 ms; con el sol a unos 4,6° quedan bajo el horizonte 6 530 de 66 049 celdas); capturas al ocaso del valle y del desierto. Sin tests automáticos, a petición del propietario.

Bloque 12 implementado (`src/lib/world/life/birds.ts`, `dust-devils.ts`; conectado en el motor):
- **Milanos planeando en térmicas**: 12 siluetas en V de 1,6 m de envergadura, dos por cada una de las seis térmicas (sobre la meseta, la cantera y los bordes del desierto), a 70–190 m sobre el suelo.
  - Cada una gira en su térmica (radio de 35–110 m, 0,08–0,16 rad/s, en uno u otro sentido), inclinada hacia el centro, con ángulo diedro, subidas y bajadas de ±6 m y aleteos ocasionales.
  - Todo el movimiento se calcula en el shader a partir de búferes estáticos (`InstancedBufferGeometry`), sin trabajo por fotograma en la CPU. Las alcanza la bruma de la escena.
- **Remolinos de polvo**: como mucho dos a la vez, cada uno con 260 partículas en una hélice que se ensancha hacia arriba hasta 65 m, con inclinación oscilante.
  - Nacen solo de día, en arena (al oeste del valle, fuera de la cantera y a más de 170 m de las pirámides) y a 400–1 200 m de la cámara.
  - Derivan con el viento a 4 m/s, viven 32 s con aparición y desvanecimiento, y esperan 18–55 s entre uno y otro.
  - Usan un sistema propio y pequeño en vez de reutilizar las motas, porque las motas están ligadas a una caja alrededor de la cámara.
- Ambos se desactivan en nivel bajo y con movimiento reducido. Son una ilustración del ambiente, no un censo de fauna.
- **Verificación**: `pnpm check` y Biome limpios; captura con milanos visibles y sin errores en la consola (los errores restantes venían de recargas de la otra sesión). La aparición de los remolinos no se pudo encuadrar en la captura, porque nacen en dirección aleatoria. Sin tests automáticos, a petición del propietario.

Bloque 14 implementado (`src/lib/data/block-targets.ts`, motor, `BlockPanel.svelte`, `ConstructionTools.svelte`, `Inspector.svelte`, `director.ts`):
- **Datos** (`BLOCK_TARGETS`):
  - Keops conserva sus 201 hiladas medidas.
  - Kefrén y Micerinos usan **hiladas esquemáticas** de 0,68 m, la media de las de Keops (`SCHEMATIC_COURSE`), hasta su altura actual: 200 y 89 hiladas.
  - Sus totales de bloques son **derivados** del volumen entre el volumen medio de un bloque de Keops: ≈ 1,96 M y ≈ 0,21 M.
  - La base de Micerinos se toma como la media de sus dos lados (102,2 y 104,6 m), porque la disposición de bloques supone una base cuadrada.
  - El panel muestra estos rótulos de esquema y derivado.
- **Motor**:
  - `setTarget(id)` reensambla y apaga las herramientas (rayos X, construir, origen, física, Inspector).
  - Cambia la pirámide oculta por el campo de bloques, recalcula las hiladas y su volumen acumulado, y recrea rampas, casco de revestimiento y polvo de juntas con la forma del objetivo.
  - Genera la nueva disposición en el worker y, en modo libre, vuela la cámara hasta la pirámide.
  - Ya no queda código fijado a Keops salvo sus interiores, que solo se muestran con Keops (Kefrén y Micerinos necesitan fuentes antes de modelar sus cámaras).
- **Selección**:
  - En «Explorar libremente», con un selector de tres cartuchos (`RadioGroup` de Bits UI) o con un clic sobre la pirámide en la escena (raycast contra los LOD).
  - En el recorrido guiado se vuelve a Keops, porque los capítulos de bloques son de Keops.
- **Vuelo de cámara reutilizable**: `director.focus(posición, objetivo, segundos)` interpola con un arco elevado (`power3.inOut`) y lo cancela cualquier gesto. Es la base del bloque 15.
- **Error encontrado y corregido**: compilar en caliente (`compileAsync` y el calentamiento del pipeline) mientras el bucle de render ya corre producía errores de validación de WebGPU («Attachment state … is not compatible»). Ahora, con el bucle en marcha, la compilación es perezosa al primer dibujado. Esto también protege el cambio de calidad tras el benchmark.
- **Interfaz**: el panel, la línea de tiempo y el Inspector usan el nombre, el cartucho, las hiladas y los totales de la pirámide activa. Los años de obra y la mano de obra solo se muestran para Keops, porque no hay fuente para las otras.
- **Pendiente**: la vista por origen de Micerinos no colorea todavía sus 16 hiladas de granito en los bloques; solo muestra el casco y la leyenda.
- **Verificación**: `pnpm check` y Biome limpios; dos ciclos completos Kefrén → Micerinos → Keops → deconstruir sin errores en la consola, y capturas de Kefrén y Micerinos deconstruyéndose. Sin tests automáticos, a petición del propietario.

Bloque 15 implementado (`src/lib/data/hotspots.ts`, `src/lib/engine/hotspots.ts`, `src/lib/ui/HotspotLayer.svelte`, `director.focus`):
- **11 anotaciones** con texto en inglés y fuentes (`Fact`). Los anclajes salen de datos existentes:
  1. La Esfinge (`SPHINX`, `SPHINX_PLACEMENT`).
  2. La entrada original de Keops (17 m de altura, 7,9 m al este, hilada 19; `KHUFU_OPENINGS`).
  3. El túnel de al-Mamún.
  4. Los restos del revestimiento.
  5. Los fosos de barcas (plano de Lepsius).
  6. La calzada de Keops.
  7. El Cementerio Oriental (centro de las 84 mastabas del GIS).
  8. El revestimiento superviviente de Kefrén.
  9. El monolito sin terminar (`QUARRY_TRACE`, posición aproximada y así rotulada).
  10. El granito de Micerinos.
  11. La brecha de 1196.
- Cada anotación tiene un encuadre (distancia, rumbo y elevación respecto al anclaje) que se resuelve con la posición real de las pirámides y la altura del terreno; la cámara nunca queda bajo el suelo.
- **Vuelo de cámara**: al pulsar un marcador o elegir en la lista, `engine.focusHotspot(id)` detiene el dron y vuela con `director.focus`.
  - El vuelo es un arco elevado con `power3.inOut` y dura entre 1 y 3,5 s según la distancia.
  - Al llegar, OrbitControls queda centrado en el anclaje para orbitar y hacer zoom, y cualquier gesto cancela el vuelo.
  - Con movimiento reducido, el cambio es un corte.
- **Marcadores**: botones numerados (Bits UI) situados con la proyección que publica el motor en el store `hotspotMarkers`, solo cuando cambian.
  - La oclusión se comprueba 10 veces por segundo en la CPU, contra los volúmenes analíticos de las tres pirámides y el perfil del terreno, en lugar de lanzar rayos contra mallas grandes. Los ocultos se ven al 35 %.
  - Se ocultan fuera de pantalla o a más de 2,6 km.
- **Tarjeta** no modal con «Punto n de 11», título, texto, rótulo de estimación si procede, fuentes y anterior, siguiente y cerrar. La **lista «Points of interest»** (`Popover` de Bits UI) es la alternativa con teclado.
- **Cambio respecto al diseño**: en el recorrido guiado las anotaciones se ocultan por completo, en vez de mostrar las del capítulo, para no competir con las tarjetas de capítulo ni con el scroll. También se ocultan mientras vuela el dron.
- **Verificación**: `pnpm check` y Biome limpios. En el navegador: los marcadores aparecen tras detener el dron (los ocultos, atenuados), el vuelo a la entrada de Keops deja los marcadores 2 y 3 sobre la entrada y el túnel modelados, y la consola no tiene errores. Sin tests automáticos, a petición del propietario.

Bloque 5 implementado: perfilado, optimización y revisión.
- **Medición**: `?perf` publica la mediana, el p95 y el peor fotograma, más el recuento de geometrías y texturas, en la vista más cara (dron al amanecer).
  - En la RTX 3050 los tiempos de fotograma quedan cuantizados por el vsync, así que solo dicen si se llega o no a 60 fps.
  - La gráfica integrada Intel (gen-12lp) sí mide el coste real. Las timestamp queries de GPU no se resuelven con stats-gl sobre el renderer de three (`gpuMs` sale a 0); el campo se mantiene, pero no se usa como dato.
  - Atención: agent-browser solo usa la RTX si se lanza con `--force_high_performance_gpu`; si no, cae en la integrada.
- **Diagnóstico por A/B en la gráfica integrada**, en nivel bajo:

  | Caso | Mediana |
  | --- | --- |
  | Escena completa | 317 ms |
  | Sin las normales del suelo | 150 ms |
  | Suelo de color plano | 33 ms |

  El sombreado del suelo era el 90 % del fotograma.
- **Optimizaciones**:
  - Normales del suelo con diferencias hacia delante: 3 evaluaciones por escala en vez de 4.
  - El detalle (dunas, crestas, cantera) solo se calcula dentro de un radio por nivel (`terrainDetailFar`: 500, 900 y 1 600 m), con ramas `If` reales.
  - La deriva de arena, las fisuras, las ondas, los canales y los escombros de la cantera solo se calculan donde se ven. El nivel regional del horizonte solo se calcula fuera del DEM.
  - El ruido de Perlin 3D (`mx_noise_float`) se sustituye por el ruido de valor 2D del proyecto en el color del suelo y en las nubes (cielo y sombras a la vez, para que sigan coincidiendo).
  - La resolución de render en nivel bajo baja a 0,75.
  - Resultado en la Intel, nivel bajo: de **317 a 66 ms** (≈ 5 veces más rápido); nivel medio, 233 ms. En la RTX, los cuatro niveles van a 16,7 ms de mediana y 16,8 ms de p95, sin tirones (antes ultra tenía un p95 de 83 ms). El aspecto se comprobó con la misma captura.
- **Respaldo WebGL2** (`?backend=webgl`, limitado a medio): 60 fps y sin errores; el arranque es lento (~37 s) por la compilación en GL.
- **Recursos**: tras tres ciclos de cambiar de pirámide, deconstruir, reensamblar y abrir anotaciones, quedan 54 geometrías y 41 texturas, estables desde el primer ciclo (los +5 / +1 iniciales se crean de forma perezosa). No hay fugas ni errores en consola.
- **Móvil** (390 × 844):
  - Se corrigió el solape del título con los controles superiores: en móvil el selector de luz muestra solo el icono y se oculta el subtítulo.
  - El panel de bloques se limita al 42 % de la altura, con scroll interno, y queda por encima de los marcadores.
  - El indicador de scroll ya no tapa la tarjeta del capítulo.
- **Error de shader en móvil corregido** («struct OutputType vacío» en un `MeshBasicNodeMaterial`).
  - Causa: `PassNode.compileAsync` deja el MRT y el destino de la pasada en el renderer durante un `await`. Un toque durante la carga lanzaba el picker de bloques, que dibujaba con ese MRT ajeno; sus texturas no coincidían y la estructura de salida quedaba vacía.
  - Ahora el picker fija `MRT = null` y restaura el estado anterior, y no hay picking hasta que el bucle de render está en marcha.
- **Fluidez en móvil**:
  - Los dispositivos táctiles arrancan directamente en nivel bajo, en vez de en medio. Así se evitan las reconstrucciones en cascada del benchmark, que solo puede bajar.
  - El nivel bajo deja de usar MSAA 4× en el render de 16 bits y usa un LOD de terreno más grueso (`terrainLodBias` 1).
  - La aureola del sol, con sus 9 lecturas de profundidad por píxel, solo se evalúa cuando el sol es visible, mediante una rama uniforme.
- **Tests**: 104 unitarios en verde, y el proyecto de componentes en navegador no tiene tests. La suite E2E de Chromium se interrumpió al cerrarse la sesión anterior y, a petición del propietario, no se volvió a lanzar. `quality.spec.ts` se actualizó al nuevo nivel inicial táctil, sin ejecutarlo.
- **Límite conocido**: en gráficas integradas modestas el nivel bajo ronda los 15 fps. El siguiente paso sería precalcular en una textura la altura de detalle (dunas, crestas y cantera) en el worker del terreno, para que las normales no evalúen ruido por píxel.

Estado de los bloques 3 y 4:
- **Bloque 4 (vida y movimiento)**: cumplido con lo hecho en la Fase 8 y en el bloque 12.
  - Viento: arena arrastrada en el suelo con rachas.
  - Polvo: motas en los haces de luz y polvo de las juntas al deconstruir.
  - Sombras: sombras de nubes y sombra de horizonte del terreno (bloque 13).
  - Fauna y remolinos: milanos lejanos y remolinos de polvo ocasionales.
  - Los remolinos usan un sistema pequeño propio porque las motas están ligadas a una caja alrededor de la cámara.
  - Nada tapa el texto del DOM, y la vida se desactiva en nivel bajo y con movimiento reducido.
- **Bloque 3 (piedra construida)**: hecho en parte.
  - **Hecho**:
    - pirámides con tono por hilada y bloque, juntas hundidas, relieve picado, desgaste de la base y pátina (bloque 9);
    - revestimiento de Tura con vetas y granito con moteado (Fase 5);
    - reinas como núcleos de mampostería por hiladas;
    - roca madre de la cantera estratificada;
    - sector del templo funerario de Keops con losas de basalto, hiladas de caliza, juntas geométricas, roturas y materiales propios (§13.1).
  - **Falta**:
    - extender la geometría detallada y las roturas a los demás templos y mastabas; la mejora del sector de Keops no completa todo el bloque;
    - la oclusión de contacto específica en juntas y bases (ahora solo el AO de pantalla, que en nivel bajo está apagado);
    - revisar el aspecto de la piedra en la vista «Antes» (revestimiento completo de Tura) de cerca y de lejos.

Bloque 16 implementado (`src/lib/materials/ashlar.ts`, `src/lib/data/workers-town.ts`, `src/lib/world/era/workers-town.ts`, anotaciones):
- **Sillería** (`createAshlarMaterial`): material TSL en coordenadas del mundo, sin texturas.
  - En las caras verticales traza hiladas y bloques de longitud variable en cada hilada, con juntas hundidas mediante el gradiente de superficie (relieve que se desvanece entre 30 y 160 m). Cada bloque tiene su tono, y las caras superiores llevan polvo y la sombra de las nubes.
  - Tres variantes:
    - **caliza**: hiladas de 0,85 m y bloques de 1,1–2,2 m, para templos, mastabas, calzadas y el muro del Cuervo;
    - **granito**: hiladas de 1,6 m y bloques de 2,2–4,2 m, para el templo del valle;
    - **adobe**: ladrillos de 12 × 34 cm, para la ciudad.
  - Sustituye a la caliza genérica y al granito de las ruinas del complejo, y a los templos de la reconstrucción «Antes».
- **Muro del Cuervo** (`WALL_OF_THE_CROW`, establecido, AERA): 200 m de largo, 10 m de alto y 10 m de grosor en la base, con talud solo en las caras largas.
  - La puerta mide 2,6 × 7 m y es un túnel bajo un dintel macizo. El muro se levanta en tramos de 20 m que siguen el terreno.
  - Se ve en las dos épocas, porque sigue en pie.
- **Ciudad de Heit el-Ghurab** (`WORKERS_TOWN`, establecido; `WORKERS_TOWN_LAYOUT`, **hipótesis**). Solo aparece en «Antes» y se funde con la época, porque se desmanteló tras Micerinos.
  - Muro de recinto al oeste.
  - Cuatro conjuntos de galerías: 10, 10, 9 y 10 edificios de 35 × 4,6 m, a ambos lados de la calle principal que lleva a la puerta.
  - El Edificio Administrativo Real con diez silos.
  - Seis panaderías, y los pueblos Occidental (22 casas) y Oriental (28 casas).
  - La fuente da los componentes, el área (más de 7 ha) y la posición relativa (unos 400 m al sur de la Esfinge, al sureste del muro), pero no la planta. Las medidas de cada edificio, los techos y las posiciones exactas son visuales y así se rotulan.
- **Presencia de la ciudad** (ajuste pedido por el propietario): en «Explorar libremente» se ve siempre como previsualización translúcida al 35 %. Al enfocar su anotación pasa a verse completa y opaca, y al cerrarla vuelve a la previsualización con una transición suave (0,6 s). En el recorrido sigue la época del capítulo «Then and now». El motor combina los tres casos en un único valor de presencia.
- **Anotaciones nuevas**: el muro del Cuervo y la ciudad de los constructores (13 en total). La de la ciudad explica que sus restos están enterrados y que la reconstrucción aparece en el capítulo «Then and now».
- **Bloque 3**: con la sillería, los templos y las mastabas ya no son cajas lisas. Quedan pendientes la oclusión de contacto en juntas y bases, y revisar de cerca el revestimiento de Tura de la reconstrucción.
- **Verificación**: `pnpm check` y Biome limpios; capturas de las mastabas del Cementerio Oriental, del muro del Cuervo y de la ciudad en el capítulo «Then and now», sin errores en consola. Sin tests automáticos, a petición del propietario.

Corrección de la «capa blanca» en Keops (revisión del propietario):
- **Causa principal**: durante el benchmark de calidad se mostraba el campo de bloques de la deconstrucción, más claro que la sillería, en lugar de la pirámide. Ahora el benchmark mide la escena tal como se ve por defecto, y el tono de los bloques usa `MASONRY_PALETTE.coreLight`, para que al deconstruir no cambie de color. La cima blanca de Kefrén es real: es su revestimiento de Tura conservado.
- **Moiré de las hiladas a distancia**: cuando una hilada ocupa menos de 1,5–4 píxeles (medido con `fwidth`), el material de sillería funde con su valor medio el tono por hilada, las juntas, el polvo de los escalones, la normal (pasa a la de la pendiente de la cara, 52°) y la autosombra de los escalones (0,82).
- **Queda un aliasing geométrico tenue**: los propios escalones son más finos que un píxel, y también influye algo el AO de pantalla. Adelantar el LOD liso a unos 700 m lo eliminaría, pero el dron vuela en esa franja y produciría saltos; queda como opción.

Ajustes tras la revisión del propietario:
- **Moverse en «Explorar libremente»**: el paneo de OrbitControls era en el plano de la pantalla, así que con la cámara casi horizontal no se podía avanzar sobre la meseta. Ahora se panea paralelo al suelo (`screenSpacePanning = false`) y la rueda acerca hacia el cursor (`zoomToCursor`). Además, las flechas del teclado desplazan la cámara; escuchan en el lienzo, que es enfocable, para no interferir con la navegación por teclado de los controles de Bits UI.
- **Pirámides de las reinas**:
  - G1-a/b/c y G3-a pasan de caras lisas con piramidión dorado a núcleos de mampostería por hiladas esquemáticas de 0,68 m (`SCHEMATIC_COURSE`), con bloques perdidos y erosión de aristas, sin piramidión.
  - G3-b/c conservan sus 4 plataformas documentadas, pero cada una está hecha de hiladas con caras verticales (nueva opción `stepHeight` del generador).
- **Roca madre de la cantera**: cada bloque es ahora geometría propia en metros (`weathered-block.ts`), con estratos horizontales erosionados (capas de 0,45–0,85 m y surcos de hasta 0,3 m), aristas redondeadas irregulares y picado, todo fusionado en una sola malla. Es una forma procedural inspirada en la caliza estratificada de la formación Mokattam, no un levantamiento.

### 13.1. Sector arqueológico: templo funerario de Keops ✅

Primer sector del bloque 3, elegido después de revisar los bloques completados. Se conserva la implantación existente del templo; el detalle de las demás construcciones queda pendiente.

1. Sustituir el pavimento monolítico por losas de basalto irregulares, con juntas, cantos biselados, piezas perdidas y una base de caliza visible.
2. Descomponer los restos de muros existentes en hiladas de caliza con juntas físicas, coronaciones rotas y fragmentos al pie, dentro del sector.
3. Dar a ambos materiales variación por pieza, rugosidad, picado fino y polvo; reutilizar la iluminación y la normal de relieve del proyecto.
4. Fusionar geometrías por material, simplificar a distancia y liberar todos los recursos al cerrar la escena. Sin nuevas texturas descargables, luces ni pasadas.
5. Añadir un punto de interés con fuente y rótulo de interpretación; revisar visualmente desde cerca y lejos en WebGPU y WebGL2, y comprobar tipos y formato.

Fuentes: [AERA, Great Pyramid Temple](https://aeraweb.org/projects/great-pyramid-temple/) y [ARCE, conservación del templo](https://arce.org/project/great-pyramid-temple-conservation-project/). Documentan el pavimento irregular de basalto y su preparación sobre caliza. Las juntas, roturas, alturas conservadas y posiciones de fragmentos de esta escena son interpretativas: no reproducen un levantamiento piedra por piedra. No se añaden pilares completos, relieves inventados ni una planta nueva al estado actual.

Implementado:
- `khufu-temple.ts` sustituye únicamente los bloques etiquetados `khufu-temple` del complejo existente; mantiene sus dimensiones, implantación y exclusiones de cámara/objetos.
- Pavimento de losas de contorno irregular, algunas fracturadas, con pérdidas que dejan ver la preparación de caliza. Muros con aparejo desplazado entre hiladas, juntas físicas, biseles, coronación rota y fragmentos apoyados en el terreno o en la losa que tienen debajo.
- `archaeological-stone.ts`: dos materiales PBR/TSL con tono por piedra, polvo sobre caras superiores, rugosidad y relieve fino que se desvanece a distancia. Reutiliza las sombras de nubes y la normal por gradiente superficial. Sin imágenes, dependencias ni luces nuevas.
- Dos mallas por nivel, 21 450 triángulos de cerca y 3 142 a distancia. El LOD cambia a 320 m con histéresis del 12 %; conserva las mismas losas y pérdidas del pavimento. Es un presupuesto de render, no una cifra arqueológica.
- Punto de interés «Basalt court of Khufu’s temple» en la lista existente de Bits UI, con vuelo al patio, fuente ARCE y explicación expresa del carácter interpretativo. La Esfinge no cambia.
- Verificación: `pnpm check` sin errores ni advertencias y Biome limpio en los archivos de este sector; diagnóstico de geometría finita, contención dentro del sector y liberación de sus cuatro geometrías y dos materiales compartidos. No se añadieron tests automáticos.
- Revisión de navegador: WebGPU alto y WebGL2 medio, vistas cercanas y vuelo desde el punto de interés, sin errores de consola. En esta máquina, la vista del patio registró 16,7 ms de mediana (WebGPU alto: p95 17,4 ms; WebGL2 medio: p95 17,1 ms). Son muestras de 240 fotogramas con vsync y trabajo concurrente, no una certificación en móviles o gráficas integradas. No se repitió la suite E2E global.

### 13.2. Personas y vida cotidiana

Primer conjunto junto a las panaderías de la ciudad existente: molienda de grano, preparación de pan y transporte de vasijas. Fuentes: [AERA, Feeding Pyramid Workers](https://aeraweb.org/feeding-pyramid-workers/) y [AERA, Lost City](https://aeraweb.org/projects/lost-city/). Las tareas se basan en la evidencia de producción alimentaria; la apariencia, las poses, el número de personas y la disposición del taller son interpretativos.

- Figuras articuladas con proporciones humanas, rostros sencillos, vestimenta de lino y utensilios; geometría y materiales compartidos, sin descargas externas.
- Animación en el bucle existente, limitada por distancia y calidad; movimiento reducido conserva poses estáticas. Nada se anima fuera de la zona visible.
- Presencia ligada a la reconstrucción de la ciudad y a su nuevo punto de interés «Daily life: bread and grain», con encuadre a escala humana y fuentes.
- Comprobar que personajes y utensilios se apoyan en el suelo, que no atraviesan edificios, que las tareas se entienden y que funcionan WebGPU y WebGL2.
