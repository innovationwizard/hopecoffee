# Preguntas para Héctor — MVP del Laboratorio

**Fecha:** 2026-04-15
**Contexto:** reunión en vivo con Héctor para definir el MVP del módulo de Laboratorio / Inventario. El objetivo del MVP es lograr que Héctor use la app todos los días. Estas preguntas buscan entender exactamente cómo trabaja hoy, dónde le duele el flujo actual y qué características y funciones mínimas le haría abrir la app el lunes por la mañana sin que nadie se lo pida.

**Cómo usar este documento:** caminar por las secciones en orden. No hace falta hacer todas las preguntas — si Héctor se desvía a un tema específico, profundizá ahí. Los bloques marcados con **★** son bloqueantes para empezar a codear; los demás son para ajustar el diseño.

---

## A. Su día de trabajo (contexto general)

A1. **★** Contame tu día típico. Desde que llegás al beneficio hasta que te vas, ¿cuáles son las 5 o 6 cosas principales que hacés?
- Oficina, no beneficio. 
- 1. Viendo el mercado, 4am, 4.30, 4.45 de la mañana. STONEX. barchart. 
- Que la app tenga dónde subir el nivel de mercado y a qué hora se subió el dato. Que quede el registro de que sí estuvo subido el nivel. 
- 

A2. ¿Qué hacés primero cada mañana? ¿Qué es lo primero que necesitás saber para empezar a trabajar?
- PRE: Douglas alimenta el reporte de cataciones. Héctor cata en papel, codificado para no revelar la muestra. Douglas digita en un excel. 
- Héctor necesita ver los resultados vinculados a un RECIBO DE MUESTRA. Puede ser una oferta, puede ser un ingreso a beneficio, puede ser una muestra de trilla, puede ser una muestra de embarque. El documento de resultados muestra todos los resultados cualitativos de la muestra evaluada. ENUMS: Oferta de compra, Oferta de Venta, Muestra de Ingreso de Café, Muestra de Resultado de Trilla, Muestra Pre-Embarque, Muestra TIPO. 
- Hablar con clientes, prospectos, posibles compradores. Demanda, diferenciales, qué están comprando, cómo está la demanda. Temprano con Europa, Asia. Al llegar a la oficina, Estados Unidos y regiones cercanas. 
- Parte práctica en el Lab: Evaluación de Cafés. La app ya tiene los 10 parámetros del SCA. Héctor tiene un mejor formato con todos sus descriptores con checklist (checkboxes, boolean) .
- En la parte de Evaluación de Cafés está la parte proyectada: Diseñar los BLENDS por tal porcentaje de RECIBO A, tal porcentaje de RECIBO B, tal porcentaje de RECIBO C, etc. 
- Nota de nomenclatura: Input Héctor llama RECIBO. Outputs para ventas Héctor llama LOTE, A LO QUE TIENE NÚMERO DE OIC. 
- Producción: Hacer las órdenes de trilla. Héctor necesita tener acceso a los inventarios: Número de recibo, Proveedor, Resultados de la Catación FROM checklist (checkboxes, boolean). 
- Supervisión de exportaciones: muestra de embarque aprobada -> fechas de bookings, fechas de carga, sacos de exportación; al tener fechas de carga, coordinar con beneficios y programar la trilla para el día que Evelyn necesita que se cargue. La Evelyn del comprador se comunica con la Evelyn de Héctor para coordinar toda la logística. 

A3. ¿Cuántos días a la semana estás en el beneficio? ¿Cuántos en oficina? ¿Cuántos en el campo o visitando fincas?
- Mayoritariamente oficina
- Salidas esporádicas a beneficio, trillas, ferias, etc. 
- Época alta, dos veces al mes. 

A4. ¿Tenés un equipo que trabaja con vos? ¿Cuántas personas? ¿Qué hacen ellos y qué hacés vos?
- Evelyn y Duglas
- Evelyn ve la parte logística y de exportaciones. 
- Duglas ve la parte de control de calidad. Duglas sí va al beneficio a hacer el control de calidad de las producciones. 

A5. ¿Hay alguna época del año en la que el trabajo se triplica? ¿Cuál es la temporada más intensa?
- Febrero a Junio es la más alta
- Diciembre a Agosto es fecha de embarque. 
- 

---

## B. Herramientas que usás hoy

B1. **★** ¿En qué llevás tu información hoy? ¿Papel, cuaderno, Excel, WhatsApp, otra app?
- Todas

B2. Si es Excel: ¿cuántos archivos? ¿Los compartís con alguien? ¿Cada cuánto los actualizás?
- UNO: Shipments. 

B3. Si es papel: ¿tenés una libreta, planillas sueltas, un archivo físico por proveedor?
- Notas de reuniones. Cálculos. 

B4. ¿Usás computadora, celular o tablet para registrar cosas durante el día?
- Compu y cel. 

B5. ¿Cuál de esos dispositivos tenés más a mano cuando estás en el beneficio?
- Cel .

B6. ¿Hay algo que ya hacés en la app actual de HopeCoffee? ¿Qué?
- No. 

B7. ¿Qué herramienta o archivo perderías primero si se rompe? O dicho de otra forma: ¿cuál es tu fuente de verdad para inventario hoy?
- Inventarios. 

---

## C. Inventario — el beachhead

*Esta es la primera pantalla que vamos a construirle. Queremos que responda "¿cuánto café tengo ahora mismo, de quién, en qué bodega, con qué calidad?" en menos de 10 segundos.*

C1. **★** Cuando alguien te pregunta *"¿cuántos quintales de pergamino de Danilandia tenés en La Joya ahora mismo?"*, ¿qué hacés? ¿Cómo lo averiguás hoy?

C2. **★** Si pudieras abrir una sola pantalla y ver todo lo que tenés físicamente en inventario, ¿qué columnas necesitás ver? Repasemos una por una:

- [ ] Número de lote / identificador
- [ ] Proveedor
- [ ] Bodega / beneficio donde está físicamente
- [ ] Cantidad en quintales
- [ ] Calidad / puntaje / NOTAS
- [ NO] Fecha de recepción (cuándo entró)
- [ NO] Días que lleva guardado
- [ REDUNDANTE] Si ya se cató o no
- [ ] Rendimiento (contratado y real)
- [ ] Región

C3. **★** ¿Cómo filtrás o agrupás el inventario hoy? Por ejemplo:

- [SÍ ] Por bodega / beneficio
- [ NECESITO] Por proveedor
- [ NECESITO] Por calidad / puntaje
- [ NO] Por fecha de recepción
- [ NECESITO VER QUÉ FALTA POR CATAR] Por estado (con catación / sin catación)
- [ NO] Por contrato al que está asignado
- [ NECESITO] POR REGIÓN

C4. ¿Tenés varias bodegas físicas? ¿Cuántas? ¿Cómo se llaman? (Hoy la app tiene tres instalaciones: Beneficio, Bodega, Patio. ¿Es correcto? ¿Faltan? ¿Sobran?)
- Dos beneficios que a la vez son bodegas, almacenamos y procesamos. La Joya y Planta Monte De Oro. 

C5. ¿Cada bodega tiene una persona encargada distinta, o todo pasa por vos?
- Sólo HÉCTOR

C6. ¿Movés café de una bodega a otra? ¿Cada cuánto? ¿Cómo lo registrás hoy?
- Sí pasa
- Orden de retiro, envío, OTRO recibo con otro correlativo

C7. ¿Qué es lo que más odiás del flujo actual de inventario? ¿Dónde se te escapa el tiempo?
- NO TENGO ACCESO A NADA.
- NO PUEDO VER LO QUE NECESITO. 
- SI QUIERO VER ALGO, TENGO QUE BUSCAR LA INFORMACIÓN Y ARMARLA YO. 

C8. Si te digo *"abrí la app y decime cuántos quintales de café rendimientos ≥ 1.32 tenés de José David en este momento"* — ¿es una pregunta que te hacen seguido? ¿Qué tan seguido?
- Cuánto café por proveedor
- Cuánto café por región 
- Cuánto café por score
- Cuánto café por bodega
- Cuánto café por CLASE: ORO, PERGO, SUBPRODUCTOS , sacos vacíos. (Aparte es empaque para exportación: sacos de exportación y bolsas. )

---

## D. Recepción de café (ingresos de bodega)

*Cada vez que entra café físico a una bodega, alguien lo tiene que registrar. Este es el momento donde se crea un "RECIBO DE INGRESO" en el sistema.*

D1. **★** ¿Cuántos ingresos de café recibís por semana en temporada alta? 
- un recibo cada 25 sacos, un trailer puede traer 500 sacos, una semana puede recibir 5 trailer. == 100 RECIBOS
¿Y en temporada baja?
- CERO.

D2. ¿Quién registra los ingresos hoy? ¿Vos, tu equipo, el encargado de cada bodega?
- LA JOYA lo registra en su sistema. 
- Todo lo demás, Roberto (CONTA). 

D3. Cuando llega un camión con café, ¿qué datos anotás en el momento?


- [sí ] Fecha
- [sí ] Proveedor
- [SÍ ] Bodega que recibe
- [SÍ] Cantidad en quintales (pergamino)
- CLASE. ORO. PERGO. CEREZA NO, ESO SÓLO LO RECIBE BENEFICIO HÚMEDO. CEREZA SECA. 
- Material del saco ( nylon o yute )
- [SÍ ] Número de recibo / comprobante
- PILOTO
- CAMIÓN
- PROCEDENCIA: Finca x, Región a

D4. ¿El precio por quintal lo tenés negociado de antemano (contrato de compra) o se define en el momento de entrega?
- Ambos casos: primero se compra y después se recibe, Y TAMBIÉN primero se recibe y después se compra. 

D5. ¿Un mismo ingreso puede tener café de distintas calidades mezcladas, o siempre es una sola calidad por ingreso?
- Sí puede tener distintas

D6. ¿Hay algún número de recibo estandarizado que el proveedor trae? ¿Cómo se parece? (ej.: "R-00123", "Recibo No 568").
- No. Lo emite cada bodega. Puede ser una hoja de cuaderno a mano. 

D7. **★** Si construimos una pantalla para registrar un ingreso, ¿preferís:
- (a) Llenar un formulario de un ingreso a la vez, ó
- (b) Una pantalla tipo Excel donde podés cargar 10 ingresos de corrido, ó
- (c) Las dos opciones?
---> Opción a = uno por uno. 

D8. ¿Tenés inventario cargado hoy en algún lado que quisieras subir a la app de una sola vez para arrancar? ¿Cuántos lotes? ¿En qué formato está (Excel, papel, otro)?
- No existe. 

---

## E. Catación (Laboratorio de Calidad)

E1. **★** ¿Cada cuánto hacés catación? ¿Diario, semanal, por tanda cuando entra café?
- Diario

E2. ¿Cuántas cataciones hacés por semana en promedio?
- Por día: entre 8 y 10 diarias. 

E3. ¿Quién cata? ¿Solo vos, o hay otro catador certificado?
- Dos catadores: Héctor y Duglas. 

E4. Cuando vas a catar un lote, ¿qué información necesitás tener a mano ANTES de empezar?
---> HÉCTOR NINGUNA.
---> DUGLAS, todo lo siguiente (TIENE UN FORMATO, PEDÍRSELO). 
- [ ] Número de recibo / lote
- [ ] Proveedor
- [ ] Rendimiento contratado (lo que dice el contrato)
- [ ] Puntaje esperado
- [ ] Cantidad en quintales
- [ ] ¿Algo más?

E5. ¿Usás el protocolo SCA de 10 atributos (fragancia, sabor, acidez, etc.)? ¿O usás un sistema más simple?
- SCA + MODELO PROPIO. 

E6. ¿Cuánto tiempo te toma hoy registrar una catación, desde que empezás a probar hasta que terminás de anotar? ¿2 minutos? ¿10 minutos?
- UNA HORA POR MUESTRA. (Tiempos factorizables entre muestras múltiples. )

E7. ¿Qué haría que registrar una catación fuera el doble de rápido de lo que es hoy?
- Tener ya toda la información en el sistema. 
- Meter número de recibo y no tener que registrar nada más. 
- QUE EL SISTEMA HAGA LOS CÁLCULOS. 

E8. ¿Medís análisis físico también? (humedad, defectos, malla / tamaño de grano, actividad de agua)
- Duglas hace esto. 

E9. ¿Anotás el rendimiento medido del laboratorio como parte de la catación, o eso viene en un paso aparte después?
- Sí. Esto es importante para CONTA porque el rendimiento AJUSTA EL PAGO. 

---

## F. Ajuste de rendimiento — el momento "plum" ★★★

*Éste es el bloque más crítico. La sección determina si el flujo de ajuste de precios funciona correctamente.*

F1. **★** Si vos compraste café con rendimiento 1.32 y el laboratorio te da 1.33 — ¿quién gana y quién pierde? ¿Le pagás MÁS al proveedor o MENOS?
- AJUSTAMOS EL PRECIO. A MAYOR FACTOR, MENOR PRECIO. 
- CUALQUIER NÚMERO ARRIBA DEL RENDIMIENTO PACTADO, BAJA EL PRECIO. 
- CUALQUIER NÚMERO ABAJO DEL RENDIMIENTO PACTADO, NO SUBE EL PRECIO. 

F2. **★** Y al revés: si comprás con 1.32 y el laboratorio te da 1.31 — ¿qué pasa con el pago?
- Ya. 

F3. **★** ¿Cómo se calcula el monto del ajuste hoy? ¿Hay una fórmula estándar o es caso por caso? (Hoy la app tiene una constante `50 quetzales por punto de rendimiento` — ¿ese número es correcto?)
- 

F4. **★** ¿El ajuste se aplica siempre que haya diferencia, o solo si la diferencia es mayor a una tolerancia? ¿Cuál es la tolerancia? (Hoy la app usa 0.01 por defecto — ¿es correcto?)
...

F5. ¿Quién autoriza el ajuste? ¿Vos solo, o necesita la aprobación de Octavio / Pepe / alguien más?
...

F6. Cuando aprobás un ajuste, ¿cómo se entera el área de contabilidad? ¿Les mandás un papel, un WhatsApp, un correo? ¿O ya saben automáticamente?
...

F7. ¿Alguna vez rechazan un ajuste que vos propusiste? ¿Por qué motivo normalmente?
...

F8. ¿Hay casos donde el ajuste NO se aplica aunque el rendimiento difiera? (ej.: promociones, acuerdos especiales con un proveedor de confianza, ajustes cruzados entre lotes)
...

---

## G. Órdenes de trilla (milling orders)

G1. **★** ¿Quién decide qué lotes se trillan y cuándo? ¿Vos, Pepe, Octavio, el beneficio?
- Héctor


G2. ¿Cuántas órdenes de trilla generás por semana?
- 15 contenedores en abril, son 3 a 4 por semana
- Contenedores por orden de trilla pueden ser 1, 3, 6, etc. 

G3. Cuando vas a generar una orden de trilla, ¿qué información necesitás darle al beneficio?
- RECIBOS A TRILLAR
- TIPO DE PREPARACIÓN (tamaño, cantidad de defectos)
- NÚMERO DE LOTE PARA ENVASAR EN ESE NÚMERO DE LOTE
- SI LLEVA O NO LLEVA BOLSA
- PARA QUÉ FECHA TIENE QUE ESTAR LISTO
- 



G4. ¿Una orden de trilla puede combinar lotes de distintos proveedores? ¿Pasa seguido?
- SÍ
- SÚPER COMÚN
- RECIBOS PARCIALES


G5. Cuando el beneficio termina de trillar, ¿cómo te regresan los resultados?
- sí a los siguientes. 
- [ ] Cantidad de oro exportable obtenida
- [ ] Cantidad de subproducto / rechazo
- [ ] Rendimiento real 
- [ ] ¿Cómo te avisan? (papel, WhatsApp, llamada, sistema) --> formato por correo. La JOYA = ROT = Resultado de Orden de Trilla
- Materia prima que ingresó al proceso. 


G6. ¿La orden de trilla es un documento físico que se imprime y firma? ¿O es más informal?
- Se imprime y se archiva.
- SUJETO A RECLAMO SI NO ESTOY DE ACUERDO CON LOS DATOS DE LA TRILLA. 

G7. Si la app te generara una orden de trilla que podés imprimir en PDF con todos los datos y entregarla al beneficio — ¿eso te ahorraría tiempo?
- NO IMPRIMIR. GENERAR LA ORDEN DE TRILLA Y ENVIARLA POR CORREO. 

---

## H. Rechazo / Subproducto

H1. **★** ¿Cómo registrás los rechazos / subproductos hoy? ¿Por lote, por tanda, agregado al mes?
- LO HACE ROBERTO. 

H2. Octavio nos dijo que él guarda el subproducto y no lo ha vendido — *"guardando todo, no he vendido ni un quintal de rechazos"*. ¿Sigue así? ¿Tenés inventario acumulado de rechazo en alguna bodega?
- YA LO VENDIÓ, AL MENOS PARCIALMENTE. 
- EL INVENTARIO LO LLEVA ROBERTO Y LO LLEVA POR RESULTADO DE TRILLA. 

H3. ¿Cuándo se vende el rechazo? ¿Hay un comprador regular?
- RISTRETO, SOCIO ESTRATÉGICO. FUNCIÓN DE OCTAVIO,. 

H4. ¿El rechazo está en el mismo beneficio que el café para exportar, o en otra bodega?
- MISMO BENEFICIO. 

H5. ¿Necesitás que el app te muestre el inventario de rechazo separado del inventario de pergamino / oro, o todo junto?
- SÍ. 
- NECESITAMOS UN INVENTARIO POR CLASE. 

H6. Hay 22 lotes marcados como "SUBPRODUCTO" en la base de datos hoy, sin proveedor ni bodega asignados. Los importaste con los Excel de Octavio. **¿Los querés ver en la pantalla del laboratorio? ¿O preferís que estén separados?**
- ...

---

## I. Reportes que necesitás

*Hoy estos reportes los armás a mano. Vamos a automatizar los más importantes.*

I1. **★** Decime las 3 preguntas que más te hacen y que tenés que ir a buscar la respuesta en papel o Excel:

1. ____________________________________________________ CUÁNTO CAFÉ FALTA POR COMPRAR
2. ____________________________________________________ CUÁNTO CAFÉ HEMOS VENDIDO
3. ____________________________________________________ QUÉ CALIDAD DIO DETERMINADO INGRESO
4. CUÁNTO CAFÉ POR CALIDAD POR CALIDAD TENEMOS
5. CUÁNTO CAFÉ POR CALIDAD FALTA POR COMPRAR
- TODOS LOS INVENTARIOS POR EXISTENCIAS, CALIDADES Y PROVEEDORES. 



I2. Ejemplos de reportes que mencionaste antes:

- [ ] *Cuánto café compré en total este mes*
- [ ] *Cuánto café vendí en total este mes*
- [ ] *Cuánto me falta comprar para cubrir mis contratos*
- [ ] *Cuánto compré por calidad (SHB, HG, punteo ≥ 82, etc.)*
- [ ] *Cuánto café hay en cada beneficio*
- [ ] *Inventario por proveedor*
- [ ] *Promedio de rendimiento real vs contratado por proveedor*
- [ ] *Lotes pendientes de catar*
- [ ] *Lotes pendientes de trillar*
- [ ] *Ajustes de precio aplicados este mes*
- todos aplican 

I3. De esa lista: ¿cuál es el reporte #1 que mirarías TODOS los días si existiera?
- hacemos todos. 

I4. ¿Cuál es el reporte que te toma más tiempo armar a mano hoy?
- NETEAR COMPRAS VERSUS VENTAS. 

I5. ¿A quién le mandás reportes? ¿Con qué frecuencia? ¿Semanal, mensual, cuando te los piden?
- SHIPMENT PLAN , CATACIONES, ONE DRIVE EN TIEMPO REAL . 

---

## J. Dispositivos y acceso

J1. ¿Vas a usar la app desde computadora, celular o tablet?
- COMPU

J2. Si es celular: ¿Android o iPhone? ¿Qué tan grande es la pantalla?
- ANDROID

J3. ¿Tenés WiFi estable en el beneficio y en la bodega, o se corta?
- BUENA SEÑAL CON DATOS PROPIOS. 
- SÍ PWA. EL COMPRADOR NECESITARÁ IR A CAMPO. 

J4. ¿Necesitás poder usar la app sin internet (modo offline)? ¿O siempre tenés conexión?
- SÍ PWA. 

J5. ¿Necesitás imprimir cosas desde la app? ¿Qué cosas? (etiquetas de lote, órdenes de trilla, reportes)
- QR PARA LOS LOTES DE EXPORTACIÓN de SALIDA DEL LAB EN ADELANTE. 
- Del Lab hacia atrás, sólo data legible por usuario humano. 

---

## K. Colaboración y permisos

K1. ¿Quién más de tu equipo va a usar la app? Nombres y roles.
- Ya. 

K2. ¿Hay cosas que querés que tu equipo pueda VER pero no PUEDA EDITAR?
- Config management module. 

K3. ¿Hay información sensible que solo vos podés ver? (precios, ajustes de proveedor)
- Sólo Octavio y Héctor: Precios de COMPRA. Alguna otra cosa que pida Octavio. 

K4. ¿Octavio o Pepe necesitan ver tu inventario? ¿O son mundos separados?
- Todos necesitan VER .
- Únicamente CONTA debería FULL CRUD.  

K5. Hoy acordamos que los números de Octavio (del Excel de contratos) y los números de tu laboratorio son **independientes** — no hay que cuadrarlos. ¿Estás de acuerdo con esto? ¿Hay algún caso donde sí te importaría que se crucen?
- CONTRATOS DE VENTA: Ingresamos el contrato con el número del comprador, PERO EL SISTEMA NOS UNIFICA CON UN CÓDIGO CORRELATIVO ÚNICO PROPIO DE NOSOTROS. 
- ESTE CÓDIGO CORRELATIVO ÚNICO LO GENERA EL SISTEMA CUANDO HÉCTOR INGRESA UN CONTRATO DE VENTA NUEVO. 

---

## L. Qué te haría abrir la app todos los días

L1. **★** Si te doy UNA pantalla en la app que te resuelve UN problema específico y nada más — ¿cuál sería esa pantalla? ¿Qué problema resolvería?
- INVENTARIOS. FULL END TO END SCOPE. 

L2. ¿Qué es lo MÁS doloroso de tu flujo actual? ¿Qué parte de tu trabajo odiás más?
- Tener que armar todos los días la información que necesito. 

L3. Si te construyo un inventario en vivo que puedas filtrar por bodega / proveedor / calidad y responde en menos de 10 segundos, ¿usarías esa pantalla todos los días?
- Sí. 

L4. Si además le agregamos catación rápida ligada al número de recibo, con el cálculo automático del ajuste de rendimiento — ¿valdría la pena el cambio?
- Sí. 

L5. ¿Qué feature, si lo tuvieras HOY, te cambiaría el día?
- INVENTARIOS, EXISTENCIAS, CALIDADES, PENDIENTES. FULL END TO END SCOPE. 

L6. ¿Hay algo que NO te mencioné pero que necesitás? Decímelo ahora.
- PERSIST OPEN. 

---

## M. Arranque / onboarding

M1. **★** Si arrancamos el lunes con el inventario vacío, ¿cuántos RECIBOS tenés que cargar para empezar a usarlo en serio? ¿10? ¿50? ¿200?
- ESTO ES ROBERTO. 

M2. **★** ¿En qué formato tenés esos RECIBOS hoy? (Excel, planilla, papel, libreta)
- EXCEL DE ROBERTO. 

M3. ¿Estás dispuesto a sentarte 1 hora conmigo para cargar ese inventario inicial a mano? ¿O preferís un formulario de carga masiva tipo Excel para vos mismo?
- NO ES NEGOCIABLE. 

M4. ¿Cuándo querés empezar a usar esto en serio? ¿Semana que viene, fin de mes, cuando termine la temporada?
- DESDE HACE RATO. 

M5. ¿Quién toma la decisión final de que "ahora el laboratorio corre en la app, se acabó el papel"? ¿Vos? ¿Octavio? ¿Ambos?
- HÉCTOR Y OCTAVIO. 

---

## N. Convención de signos — crítico para el flujo de ajustes ★★★

*Esta pregunta la necesita también Octavio, pero si Héctor trabaja en el campo puede saber la respuesta práctica aunque Octavio tenga la decisión formal.*

N1. **★** Traigamos un caso concreto: comprás 100 quintales de pergamino de José David al precio Q 1,777 por quintal. El contrato dice rendimiento 1.32. El laboratorio mide 1.33. ¿Cuánto le pagás al proveedor al final? ¿Más o menos que los Q 177,700 originales?
- VER LA FÓRMULA EN EL EXCEL QUE ACABAMOS DE HACER. Y LAS NOTAS EN PREGUNTA ANTERIOR. 

N2. **★** ¿Y si el laboratorio mide 1.31? (rendimiento mejor de lo esperado)
- VER LA FÓRMULA EN EL EXCEL QUE ACABAMOS DE HACER. Y LAS NOTAS EN PREGUNTA ANTERIOR. 


N3. **★** ¿Cuál de estas dos frases se acerca más a cómo lo ves vos?


- (a) *"Si el rendimiento real es peor (más pergamino por quintal de oro), el proveedor entregó café de peor eficiencia, así que le pago MENOS para compensar."*
- (b) *"Si el rendimiento real es peor, yo tuve que comprar más pergamino del esperado para sacar la misma cantidad de oro, así que le pago MÁS al proveedor por los quintales extra."*

OPCIÓN (a)

N4. ¿La fórmula del ajuste es lineal (X quetzales por cada 0.01 de diferencia) o tiene tramos / topes?
- VER LA FÓRMULA EN EL EXCEL QUE ACABAMOS DE HACER. Y LAS NOTAS EN PREGUNTA ANTERIOR. Y VALIDARLO CON OCTAVIO. 

N5. ¿Hay un rango dentro del cual el ajuste no se aplica aunque haya diferencia? (la "tolerancia")
- 0.01 (De 1.32 a 1.33 podría ser pero hay que platicarlo con Octavio) Esto es float 4. 

---

## O. Preguntas libres / abiertas

O1. ¿Hay alguna historia reciente donde el sistema actual te falló y te costó tiempo o dinero? Contámela.
- 

O2. ¿Hay algún reporte o pantalla que viste en otro sistema que te gustaría que tuviéramos acá?
- Base de datos de inventarios donde está TODO. 

O3. Si un nuevo colaborador entrara mañana al laboratorio y vos le pudieras dar una herramienta para que arranque ya — ¿qué le mostrarías primero?
- Cómo ingresar la información del Lab al sistema. 
- La parte práctica sería difícil.
- En la parte de logística y operaciones HABLAR CON EVELYN. 

O4. ¿Hay algo que sabés que está mal con el flujo actual pero todavía no tuviste tiempo de arreglar?
- NO TENEMOS ACCESO INMEDIATO A LA INFORMACIÓN DE INVENTARIOS. 

O5. De lo que te pregunté hoy, ¿qué es lo que MÁS te importa que esté en el MVP, y qué es lo que puede esperar?
- ACCESO INMEDIATO A LA INFORMACIÓN DE INVENTARIOS. 

---

## Cómo usar sus respuestas

Las respuestas a las preguntas marcadas **★** determinan:

- **A1, B1, C1, C2, C3** → diseño de la pantalla de inventario (Lab-1, ~2–3 días)
- **D1, D7, D8, M1, M2** → diseño del formulario de carga masiva (Lab-2, ~1 día)
- **E1, F1–F8, N1–N5** → diseño del flujo de catación + ajuste (Lab-3, ~3–4 días)
- **G1, G3, G5** → diseño de órdenes de trilla (Lab-5, después de Lab-3)
- **H1, H6** → política de visibilidad del subproducto histórico
- **I1, I3** → qué reportes construir primero (Lab-6)
- **L1, L5, O5** → validar o cambiar el "beachhead" (actualmente pensamos que es el inventario en vivo, pero si él menciona algo más doloroso tenemos que replanear)

Las respuestas a los bloques **★★★** (F y N) son bloqueantes para Phase Lab-3 — sin ellas no podemos construir el flujo de catación correctamente.

*Fin del cuestionario. Suerte en la reunión.*
