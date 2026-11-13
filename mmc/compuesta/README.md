# MMC compuesta

Módulo independiente en `compuesta/`. No modifica los motores ni archivos de MMC simple o variable. El único cambio en el inicio compartido es convertir el botón de MMC compuesta en su enlace de acceso.

## Fuentes exclusivas

- `2.ERGOepm SLI-CLI (20-1-22)(1).xlsm`, suministrado en esta conversación.
- `CONDICIONES ERGONOMICAS_V26_SEPTIEMBRE_2026 (3)(2).docx`, suministrado en esta conversación.

No se ejecutan macros ni se utilizan los enlaces externos que aparecen en otras secciones del Excel. La ruta implementada es `4.Factores!Z47/Z48/Z50/Z51` -> `5.Resultados!D19/D21/D23/D25`.

## Entrada y alcance

Hasta 50 tareas independientes; cada tarea contiene un máximo de 10 subtareas, conforme al encabezado de `4.Factores` y a las entradas habilitadas en filas 15–24. Todos los campos nuevos empiezan vacíos. Los datos de prueba no se cargan en el programa.

Cada subtarea tiene nombre, peso real del objeto, objetos del grupo, levantamientos por objeto y frecuencia. Las frecuencias se introducen con hasta dos decimales para la tabla del Excel o se calculan, por acción expresa del usuario, con producción / trabajadores / minutos netos y redondeo a dos decimales. Se comprueba la diferencia con la frecuencia total de producción, con la tolerancia de 0,10 lev/min de `4.Factores!AE45`.

Geometría de cada subtarea: altura inicial, altura final, alcance horizontal y asimetría. El desplazamiento se calcula como el valor absoluto de la diferencia de alturas. El archivo solo ofrece un alcance y una asimetría por subtarea; no se añade una evaluación independiente del alcance en destino.

Las opciones de agarre B/R/M, una o dos manos, una o dos personas y tareas adicionales físicamente exigentes corresponden a U/AD/AH/AL15:24. No se generaliza la opción de dos personas a equipos de tres o más, para los que la fórmula AJ no aplica la misma corrección.

La masa acumulada conserva el peso real de los objetos. La media por trabajador supone reparto uniforme. Se bloquea una combinación con menos trabajadores totales que personas levantando juntas.

## Cálculo trazable

- Duración: `3. Organizacion!CJ10=MAX(B10:CD10)`, incluido cualquier descanso registrado. Se conserva literalmente este criterio del archivo; no se utiliza el motor temporal de MMC variable. La frecuencia total divide por los minutos netos de levantamiento, no por esa duración.
- Geometría: M15 = 1−0,003×|Vi−75|; N15 = |Vi−Vf|; P15 = 1 si D<25, en otro caso 0,82+4,5/D; R15 = 1 si H<25, en otro caso 25/H; T15 = 1−0,0032×A. Se detectan como críticas las alturas fuera de 0–175 cm, H>63 cm y A>135°.
- Agarre: B=1, R=0,95, M=0,9, según V15.
- Frecuencia individual: AC15 elige la columna por Vi<75 / Vi≥75 y por duración ≤60, ≤120 o ≤480. `frequency-table.js` reproduce la tabla AZ136:BF1736 mediante sus nodos y tramos lineales, comprobados contra los 9.606 valores.
- Índice individual: X15/AC15/AE15, con AE15=1 para dos manos y 0,6 para una; AJ15 aplica ×0,5/0,85 cuando AH15=2; AN15 divide por 0,8 si AL15=S.
- Orden: extracción sucesiva de máximos AQ15:AQ44, conservando la primera coincidencia en empates, como AY/BG.
- Índice compuesto: primer índice individual corregido (AY15), más los FILI brutos de las siguientes subtareas (BB16 en adelante) por la diferencia de inversos de FM acumulados (L100 en adelante). Se conserva expresamente que esos sumandos del archivo utilizan X y no las correcciones de manos/personas/tareas adicionales.
- Los FM acumulados de K99:K128 utilizan las columnas BA/BB/BC del Excel (área Vi≥75), tal como están escritas las fórmulas, incluso si la subtarea individual utiliza BD/BE/BF.
- La duración superior a 480 minutos o el FM nulo genera situación crítica; no se extrapola ni se incorpora el factor de extensión de MMC variable.
- Grupos de población y colores de informe: etiquetas 20–45 / <20 o >45 y límites 1 / 1,5 / 2 / 3 del DOCX. El Excel etiqueta sus grupos como 18–45 / <18 o >45; se mantienen las masas de referencia 25/20/20/15 y la rotulación del informe solicitado, de acuerdo con el DOCX. La clasificación se realiza antes de redondear el índice.

## Interfaz

Cinco pantallas: datos/subtareas, horario, condiciones de subtareas, resultados y simulación. Guardado/carga JSON independiente con `module: "compuesta"`; copia de resultados y comparación para Word. El resumen muestra solo campos modificados. Guardado y aviso de cambios pendientes al salir, con cancelación de la salida y opción de guardar antes de volver al inicio.

## Verificación

`node tests/compuesta.cjs`

`tests/fixtures/cli-excel.json` contiene 30 escenarios sintéticos, sin datos del usuario, cuyas salidas se calcularon ejecutando un intérprete independiente de las fórmulas originales en su grafo de dependencias. Incluye 1, 2, 5 y 10 subtareas; límites de duración; alturas, alcances, asimetría y agarres; una mano; dos personas; tareas adicionales; empates y situaciones críticas.

Las comprobaciones incluyen la igualdad de FILI, índice individual e índice compuesto, campos vacíos, límites geométricos, formato JSON, simulación independiente, resumen de cambios y aviso de salida.

Esto acredita la correspondencia con las fórmulas ensayadas. No constituye una ejecución nativa en Microsoft Excel ni una validación normativa externa. El archivo original se conserva intacto.

## Edición del horario mediante horas

La pantalla y la simulación recogen inicio y fin de jornada, marca de fin al día siguiente e inicio y fin de cada tramo. `js/clock-schedule.js` calcula los minutos y exige cobertura completa de la jornada, sin huecos, solapamientos ni tramos exteriores. Los motores conservan sus categorías y fórmulas originales; únicamente reciben minutos obtenidos de las horas. Las horas prevalecen sobre cualquier campo `minutes` antiguo o desactualizado. Los estudios anteriores con inicio conocido y duraciones enteras se convierten automáticamente a horas sin modificar sus índices. Los estudios sin hora de inicio no reciben una hora inventada.

Verificación adicional: `node tests/clock-schedule.cjs` (día, medianoche, jornada de 24 horas, datos incompletos, integridad de minutos, conversión de formatos, guardado/carga y aislamiento de simulación).
