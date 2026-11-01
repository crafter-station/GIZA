# GIZA - Plan maestro

Experiencia web educativa en 3D sobre las pirámides de Giza: un tour cinematográfico por las tres pirámides con una interacción central, **la deconstrucción**. La pirámide se separa en los bloques que la forman, que quedan suspendidos en el aire y se pueden explorar, inspeccionar, reordenar y volver a ensamblar.

Este documento recoge **decisiones**, no opciones. Si una decisión se cambia, se cambia aquí primero.

**Idioma y estilo**: este plan es el único archivo en español. Todo lo demás (código, identificadores, documentación, commits y textos de la interfaz) se escribe en **inglés**, y el código **no lleva comentarios** (ni JSDoc). Reglas recogidas en `AGENTS.md`.

**Estado**: ✅ Fases 0 a 5 concluidas · 🔄 Fase 6 en curso (deconstrucción con rayos X, campo de fuerza, Inspector y derrumbe con física; faltan Construir, la vista por material y los interiores) · 2026-11-01. El detalle está en §10.

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
| Blender (última versión estable) | Retopología y horneado de la Esfinge, ajustes de escaneos y exportación GLB |
| `@gltf-transform/cli` | `optimize` con meshopt, cuantización, texturas a KTX2 y deduplicación |
| KTX-Software (`toktx`) | Compresión Basis (UASTC para normales, ETC1S para color) |
| `tools/build-terrain.ts` (`geotiff` en Node) | Recortar el DEM Copernicus GLO-30 de Giza y remuestrearlo al marco local → heightmap Uint16 (sustituye a GDAL + QGIS) |
| EZ-Tree (generador procedural de árboles para three.js) | Acacias y tamariscos → GLB |
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
| **Gran Esfinge** | **GLB**: modelo fotogramétrico **de la Gran Esfinge** con licencia CC BY o CC0, retopología en Blender a ≈ 120 k triángulos con normal map horneado del original. Si no hay licencia válida, se esculpe en Blender sobre fotos de referencia (73 × 20 × 19 m, mirando al este). El GLB aportado en la Fase 0 ("Egyptian-style sphinx statue", Sofia Nasopoulou, CC BY 4.0) es una **estatua romana del Museo de Maratón**, no la Gran Esfinge: se usa solo como marcador provisional (Fases 2–6) y se sustituye en la Fase 7 | Erosión real de las capas de la roca | 120 k triángulos + KTX2 de 2 K |
| **Pirámides de las reinas, mastabas** | Procedural: las reinas con el mismo generador; las mastabas como `InstancedMesh` de bloques rectangulares con pendiente lateral y variantes | Campo de mastabas al oeste de Keops en rejilla, como el real | Instancias |
| **Templos y calzadas** | Procedural con kit modular (muros, pilares monolíticos de granito, pavimento de basalto) | Ruinas en "Ahora", completos en "Antes" | - |
| **Rocas sueltas y escombros** | **Procedural en código** (icosaedro + cortes de fractura + erosión), `InstancedMesh` por variante | Dispersión por pendiente y escombros en las bases | 6 variantes × 180 triángulos |
| **Palmeras** | Procedural en código: tronco como tubo con anillos de cicatrices de hoja (TSL), copa de frondas instanciadas como planos curvados con alfa generada en canvas | Balanceo con viento en el vertex shader; contraluz traslúcida (técnica de la skill Seijaku) | Instancias + impostores lejanos |
| **Acacias y tamariscos** | EZ-Tree → GLB → `gltf-transform`; impostores (billboards) a distancia | Solo en el valle y la orilla | - |
| **Papiro y juncos** | Tarjetas instanciadas con alfa | Orilla del Nilo en el modo "Antes" | - |
| **Nilo y canal antiguo** | Plano de agua con material nodal: normales animadas, Fresnel, reflejo del cielo vía entorno (sin reflector caro) | Solo visible a distancia o en el modo "Antes" | - |
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
│   ├── models/ ✅                 # sphinx-marathon/ (marcador provisional); luego Esfinge, rocas, acacias
│   ├── blender/                   # .blend
│   └── photos/ · illustrations/ · textures/   # ver §11
├── static/                        # se sirve tal cual
│   ├── terrain/ ✅                # giza-height.bin + giza-height.json
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
### Fase 6 — Deconstrucción (la interacción estrella) 🔄 (en curso; núcleo funcional el 2026-11-01)
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
- ⬜ **Construir** (línea de tiempo de 20–27 años con contadores y selector de hipótesis de rampa rotuladas).
- ⬜ **Vista por material u origen**.
- ⬜ **Interiores de Keops revelados**: pasajes, Gran Galería, cámaras, Gran Vacío y corredor norte, con las medidas de §2.1. Sus posiciones horizontales necesitan una fuente acotada antes de modelarlas.
- ⬜ Polvo saliendo de las juntas en la anticipación (partículas de la Fase 8) y retumbo sonoro (Fase 8).
- ⬜ E2E del ciclo completo en CI.
- **Hecho cuando**: deconstruir → explorar → extraer → derrumbar → reensamblar funciona 10 veces seguidas sin fugas de memoria y dentro de presupuesto (✅ medido), y están todas las acciones de §3.3 (faltan Construir, la vista por material y los interiores).

### Fase 7 — Esfinge, entorno y vegetación ⬜
- Gran Esfinge definitiva: buscar un escaneo **de la Gran Esfinge** con licencia CC BY/CC0; si no existe, esculpirla en Blender. Retirar el marcador de Maratón. Franja del Nilo; palmeras procedurales, acacias (EZ-Tree), papiro e impostores; paisaje antiguo del modo "Antes" (revestimiento de Tura, puerto, orilla).
- **Hecho cuando**: el modo "Antes / Ahora" funciona como transición continua.

### Fase 8 —-Atmósfera viva y sonido ⬜
- Arena arrastrada, polvo en haces, calor en el horizonte, antorchas, noche con cielo de 2560 a. C.
- Ambiente sonoro (viento, arena, interior de piedra, retumbo de la deconstrucción, impactos del derrumbe), activado solo tras un gesto.

### Fase 9 —-Narrativa, UI y contenido ⬜
- Componentes Svelte: capítulos, panel de pirámide, Inspector, línea de tiempo, menú, plano, créditos y fuentes; tipografía con SplitText; secciones editoriales (materiales, cifras).
- Textos definitivos en inglés (`en.json`, fuente de verdad) y su traducción al español (`es.json`); accesibilidad (teclado, foco, lectores de pantalla, alternativa HTML de cada hotspot).

### Fase 10 — Optimización y QA ⬜
- Matriz de dispositivos (Chrome, Edge, Safari, Firefox; Windows, macOS, iOS, Android); ajuste de niveles; regresión visual con Playwright (`?t=`); trazas de rendimiento; revisión `code-review` completa.
- **Hecho cuando**: se cumplen los presupuestos de §8 en los dispositivos de referencia, con las mediciones anotadas.

### Fase 11 — Publicación ⬜
- Build en Vercel con cabeceras de caché inmutable y compresión Brotli; imagen OG (captura real de la app); metadatos; página de créditos y licencias (modelos, texturas, fuentes, datos DEM, citas).

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

✅ Generadas por el usuario (GPT) en PNG dentro de `assets-src/photos/materials/`. El PNG es el **original sin pérdida**: de él salen las variantes responsivas sin recomprimir dos veces. **La conversión la hace el usuario** (WebP + AVIF a 640/960/1600 px en `static/images/`), no los agentes; por eso no existe `tools/build-images.ts`. Al ser imágenes propias no llevan README de licencia. La imagen OG y el preview se capturan desde la propia app en la Fase 11.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación decidida |
| --- | --- |
| La deconstrucción no rinde en móvil | Spike en la Fase 1; conteos por nivel; superbloques; respaldo con corte en sección |
| Las APIs de TSL cambian entre versiones de three | Versión fijada por fase; actualizar solo al inicio de una fase, con capturas de regresión |
| El respaldo WebGL2 es más lento en compute | Nivel máximo "Media" en el respaldo; Derrumbe limitado |
| Errores históricos | `sources.ts` obligatorio; hipótesis rotuladas; revisión de los textos antes de publicar |
| Licencia y fidelidad de la Esfinge | Licencia verificada antes de integrar **y comprobación de que el modelo es la Gran Esfinge**; si no lo hay, modelado propio |
| El DEM solo cubre hasta 30° N | Cuadrado desplazado al sur; para ampliar al norte, descargar la tesela N30 E031 y unirla en `build-terrain.ts` |
| Peso de descarga | KTX2, meshopt, carga por regiones, presupuestos de §8 en CI con `check-assets` |
