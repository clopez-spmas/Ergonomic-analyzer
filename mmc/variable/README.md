# MMC Variable — modelo A

Módulo independiente de MMC Simple. Entrada en `variable/index.html`; `engine.js` contiene el motor sin dependencias de la interfaz.

## Fuentes autorizadas

- ES_ERGOepm_VLI__03-2025 (11).xlsx, aportado por el usuario.
- ACLARACIONES EXCEL CARGAS(1).pdf, aportado por el usuario.
- CONDICIONES ERGONOMICAS_V26_SEPTIEMBRE_2026 (3)(1).docx, aportado por el usuario.

No se han incorporado tablas ni criterios metodológicos de fuentes externas.

## Trazabilidad

- Producción y cinco categorías: `2.Datos produccion!C19:R54`, `U20:Y24`. Peso representativo ponderado redondeado a un decimal. Se conserva el orden de las filas activas. Las categorías con intervalos solapados asignan la carga a la primera coincidencia, como las fórmulas del archivo.
- Horario: `3.Organizacion!B10:CD25`. Se incluyen levantamiento, tareas sin MMC/descanso y empuje/tracción. La frecuencia de levantamiento utiliza únicamente los minutos netos de levantamiento y los objetos por trabajador.
- Geometrías: `4.Factores`, agregación de alturas por intervalos y distancias horizontales; `5.LI!AB31:AB65`. Modelo A, sin el selector de modelo B.
- FILI: `computation Table!K11:X40`. Dos áreas verticales (factores 0,78 y 1); tres horizontales (0,71; 0,56; 0,4); asimetría (1 o 0,81); agarre 0,9. El desplazamiento simplificado del archivo es 0 (factor DM=1); no se introduce el desplazamiento real de MMC Simple.
- Frecuencia: `computation Table!AZ59:BF1659`. `frequency-table.js` conserva los nodos de esa tabla y sus interpolaciones internas. La frecuencia de cada subtarea y la acumulada se redondean a dos decimales, como el archivo. Comprobados los 4.803 valores contra la tabla original: diferencia máxima inferior a 1e-12.
- ILV final: `5.Resultados!D88` → `5.LI!D88` → `computation Table!Z51` → `ES18`. Se forman seis categorías FILI con percentiles 0,8333; 0,6666; 0,5; 0,3333; 0,1666; 0. La primera contribución utiliza el máximo; las siguientes, la media aritmética de los FILI de la categoría. Se conserva MATCH con primera coincidencia y el divisor de extensión temporal.
- Clasificación y colores: tabla de niveles del DOCX (1; 1,5; 2; 3), aplicada antes de redondear. Las situaciones críticas se muestran como >3 / MUY ALTO en todos los grupos, conforme al DOCX.

## Comportamientos del Excel conservados

El horario del archivo sustituye la recuperación del último período por 500 minutos. La duración media exige un período superior a 60 y no superior a 120 minutos y recuperación al menos del 30 %. Los períodos activos se acumulan sin añadir el tiempo de los descansos insuficientes. Esto es específico de las fórmulas de este VLI; no se reutiliza el motor de horario de MMC Simple.

La síntesis del PDF se refiere a las categorías simplificadas, que pueden tener un peso medio menor que el mayor peso real. Los datos de producción originales permanecen en el estudio y se utilizan para la masa acumulada.

Cada fila de producción admite el número de personas que levantan juntas cada carga (vacío o 1 = individual). Se conserva el peso real para las categorías y la masa acumulada. Como `2.Datos produccion!X28:Y32`, el peso medio representativo de cada categoría se divide entre el número de personas, sin redondear de nuevo antes del FILI. No se añade el factor 0,85 de cálculos intermedios que no interviene en esta ruta final del Excel. La frecuencia del ILV sigue literalmente `3.Organizacion!S54` y `5.LI!Q31:Q65`: levantamientos del grupo / trabajadores / minutos netos. No se multiplica por las personas que levantan juntas. Las participaciones físicas se muestran como un dato separado: suma(levantamientos × personas simultáneas) / trabajadores; no alimentan la frecuencia del ILV.

Masa media por trabajador = suma(peso real × objetos × levantamientos) / total de trabajadores. Si una carga exige más personas simultáneas que el total de trabajadores, se ocultan los valores por persona y se bloquea el índice hasta corregir los datos. Ejemplo con 20 kg × 4 objetos × 2 levantamientos entre 2 personas: 160 kg de grupo, 80 kg por persona, 8 participaciones por persona y 4 levantamientos por trabajador en la frecuencia del Excel.

Para tramos positivos inferiores a 5 minutos se conserva la ruta literal `3.Organizacion!CE12` → `5.LI!Y22:AA22` (tres selectores FALSE) → `computation Table!AB11` (FALSE, equivalente a 0) → tabla FM de duración ≤60 min. El editor muestra «Sin seleccionar» como categoría, sin atribuir al Excel una selección corta o larga que no realiza. CE12 incluye levantamiento, empuje y descansos posteriores; excluye el descanso inicial de B10.

El Excel dispone de un único número de personas por categoría simplificada. Si varias filas terminan en una misma categoría con distinto número de personas, se solicita separar esas condiciones en tareas; no se inventa un promedio de equipos. Los archivos anteriores sin este campo conservan el cálculo individual. Los levantamientos con una mano y las modalidades antiguas sin distribución por carga siguen pendientes de validar.

Si los límites de cinco categorías, redondeados como en el Excel, dejan una carga fuera de los intervalos, el programa solicita revisión y no asigna esa carga silenciosamente.

## Verificación

`node tests/variable.cjs`

El caso de referencia del archivo aportado (100 levantamientos de 18,5 kg, cuatro trabajadores, 115 minutos netos, duración corta, geometría 51–125 cm / H 25–40 cm y asimetría marcada) devuelve 1,4325681831794734 para la masa de referencia de 25 kg.

## Edición del horario mediante horas

La pantalla y la simulación recogen inicio y fin de jornada, marca de fin al día siguiente e inicio y fin de cada tramo. `js/clock-schedule.js` calcula los minutos y exige cobertura completa de la jornada, sin huecos, solapamientos ni tramos exteriores. Los motores conservan sus categorías y fórmulas originales; únicamente reciben minutos obtenidos de las horas. Las horas prevalecen sobre cualquier campo `minutes` antiguo o desactualizado. Los estudios anteriores con inicio conocido y duraciones enteras se convierten automáticamente a horas sin modificar sus índices. Los estudios sin hora de inicio no reciben una hora inventada.

Verificación adicional: `node tests/clock-schedule.cjs` (día, medianoche, jornada de 24 horas, datos incompletos, integridad de minutos, conversión de formatos, guardado/carga y aislamiento de simulación).
