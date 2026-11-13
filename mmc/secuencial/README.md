# MMC secuencial

Módulo aislado de rotación entre tareas simples, compuestas y variables. Todos sus cambios están en `secuencial/` y en sus pruebas. No cambia archivos, cálculos ni formatos de guardado de los otros módulos.

## Importación

Hasta 50 tareas por rotación y 200 tramos. Se importan los JSON de MMC Analyzer de los módulos `simple`, `compuesta` y `variable`. Un archivo puede contener varias tareas: el selector muestra cada una por separado y permite importar solo las elegidas. También permite seleccionar las condiciones originales o una simulación guardada en el archivo de origen.

Cada tarea importada recibe un identificador local nuevo y conserva el módulo, archivo, identificador de origen y una copia de sus condiciones. Identificadores coincidentes en archivos distintos no mezclan las tareas. Las cantidades y geometrías quedan guardadas dentro del estudio secuencial, sin depender de conservar el archivo original abierto.

Las flechas ordenan la lista. Se pueden crear tramos en ese orden y aplicar el orden a un horario que tenga un tramo de levantamiento por tarea. La pantalla de horario permite elegir cualquier tarea en cada tramo y repetir tareas: una lista de origen 1,2,3 puede dar lugar a una secuencia 2,1,3 o 2,1,2,3. Los tiempos se obtienen del inicio y fin de jornada y de cada tramo, con validación de huecos, solapamientos y medianoche.

La importación y actualización son transacciones: se valida toda la selección y el límite de 50 antes de cambiar el estudio. Actualizar una tarea conserva su identificador de rotación, nombre y asignaciones temporales. Los archivos incorrectos, cancelaciones y selecciones que superen el límite no producen importaciones parciales.

## Cálculos automáticos

Se usan las condiciones físicas y de producción, no el índice final guardado o mostrado en el módulo de origen. Se recalculan automáticamente el índice intrínseco y los índices para duración corta, media y larga; no hay entrada manual ni confirmaciones de estos índices.

- Variables y compuestas: se conservan objetos, levantamientos por objeto y trabajadores. La frecuencia se obtiene con los minutos asignados a esa tarea en la rotación. Repetir una tarea distribuye esas mismas cantidades entre todos sus tramos; no multiplica automáticamente la producción.
- Simples: se conserva la frecuencia registrada porque el archivo no contiene una producción por objetos. Se representa el levantamiento constante mediante una única subtarea. Si hay control significativo en destino, se evalúan ambos extremos y se conserva el resultado más desfavorable de cada duración.
- La duración intrínseca de una tarea se obtiene del mayor tramo que tiene asignado, según la documentación secuencial proporcionada. La duración de la secuencia incorpora la acumulación de actividad y recuperación.
- Se implementan las fórmulas de resultados parciales de la documentación facilitada, incluidas las diferencias entre la agregación directa y las seis categorías FILI, los empates, las correcciones y las selecciones por altura. Las tablas de frecuencia se reconstruyen con 20/21 nodos, contrastados con todos sus valores originales.
- El agregador se generaliza de forma explícita a 50 términos: máximo intrínseco + (máximo a duración de secuencia − máximo intrínseco) × suma de índices a duración de secuencia ponderados por minutos/480, dividida por el máximo a duración de secuencia. Las tareas posteriores a la octava y hasta la quincuagésima participan en todos los máximos y en la suma. Se conserva el denominador temporal 480.
- Las cuatro poblaciones y sus masas de referencia 25/20/20/15, niveles y colores siguen la documentación proporcionada. El nivel se determina antes del redondeo a dos decimales.
- Una condición crítica se propaga como situación crítica; los datos incompletos permanecen pendientes. Un índice de larga duración no disponible no bloquea una rotación cuya duración solo requiere el de corta duración.

`partial-models.js` conserva los grafos de cálculo parcial y las tablas de la documentación suministrada. `partials.js` los evalúa con entradas validadas, sin código dinámico ni conexiones externas. `input-cli.js` e `input-vli.js` son copias aisladas para preparar y validar los datos importados; no modifican ni ejecutan los controladores de los otros módulos. Una caché de resultados evita repetir cálculos de tareas cuyas condiciones y tiempos no han cambiado.

## Guardado y simulación

Formato secuencial versión 2. Guarda condiciones importadas, procedencia, tareas, orden, horario y simulación. Acepta los estudios secuenciales anteriores, conservando sus tareas y horarios; las tareas sin condiciones físicas deben actualizarse desde sus JSON antes de calcular. No se usan sus antiguos índices manuales como sustitutos de las condiciones faltantes.

La simulación conserva las condiciones originales. Permite cambiar secuencias, tareas y tiempos y editar directamente las condiciones de cada tarea importada. Un selector y los botones «Editar condiciones» permiten trabajar con una tarea cada vez. Las simples incluyen peso, alturas inicial/final, alcance, asimetría, frecuencia, agarre, manos, personas y control en destino. Las compuestas incluyen trabajadores y producción y geometría de cada subtarea. Las variables incluyen trabajadores, cargas, personas por carga, combinaciones de alturas/alcances y asimetría por categoría. Se pueden añadir o eliminar filas dentro de los límites de cada método, conservando siempre una fila de carga o subtarea. Los nuevos campos comienzan vacíos.

`conditions.js` contiene los editores y aplica sus cambios exclusivamente a la copia simulada. La revisión de las condiciones originales sigue basándose en los JSON importados. Editar una simulación no escribe en esos archivos ni modifica `project.data`. Los cálculos se actualizan automáticamente, y las condiciones editadas se guardan en `project.simulation` dentro del estudio secuencial. La conversión de geometrías variables antiguas a filas editables se hace solo al editarlas, y la comparación usa representaciones equivalentes para evitar mostrar conversiones internas como cambios. El resumen indica solo campos modificados, con categoría y peso cuando corresponde. Se mantienen las salidas para Word, el restablecimiento de la simulación y el aviso de cambios pendientes al cerrar o volver al inicio.

## Comprobaciones

`node tests/secuencial.cjs`

`node tests/secuencial-conditions.cjs`

Incluye 56 comparaciones de categoría temporal y agregación con casos de referencia de la documentación; 15 casos y 60 comparaciones de cálculo parcial frente a una evaluación independiente de las fórmulas originales; los tres formatos JSON; varios registros por archivo; orden 2→1→3; 50 tareas con participación de la última; límites e importación atómica; frecuencias por tiempo asignado; guardado y recarga de condiciones y simulación; recuperación de formato anterior; aviso de salida; ausencia de referencias a herramientas de cálculo externas en la interfaz.

Las pruebas de edición directa cubren los tres tipos de tarea, cambios de pesos y alturas, recálculo, conversión de geometrías antiguas, límites de filas, campos incompletos y condiciones críticas, aislamiento respecto a los originales, rechazo de eventos de edición sobre el contexto original, resumen limitado a cambios reales, guardado/recarga de las condiciones simuladas y restablecimiento completo.
