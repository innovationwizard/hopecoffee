# Octavio App Audit — Transcripción

---

Vamos a desplegar.

¿Te acordás que yo te había puesto ahí que teníamos que poner cómo ingresar los gastos de exportación?

¿Aquí no está? No aparece gracias a exportación, mírate. No aparece, ahorita te lo agrego.

¿Te acordás que te había dado una cosa de lo que necesitábamos que desplegar? Para poder hacer modificaciones.

No, mira pues, solo para que estemos aquí, si quieres antes que empecemos a avanzar, validemos el menú.

Primero tienes que tener embarque, ¿sí? — Tengo embarque.

Después posición. — Tengo posición.

Posición, aquí vean, posición, bolsa, aquí no aparece cuál es, qué posición es. Dice el precio congelado, cuando ya pasamos el precio y posición está deshabilitado, dice...

Lo tenés deshabilitado. Ponerle ahí en negociación, para que podamos. Entonces ahí debería poder cambiarse.

Sí, no, porque esto ya se fue a la base de datos, una vez que fijas...

¿Y cómo lo puedo modificar si tenemos un cambio o un error? Porque aquí obviamente tenemos un cambio. En el que te mandé, para no estarte chingando de que, mira, hay que cargarlo otra vez.

Es que si me tenés que estar chingando a mí es porque el sistema no funciona. El sistema tiene que funcionar.

Va, si quieres, mira pues, solo para que estemos en sintonía. Embarque, posición, cliente.

No, no tengo cliente. ¿Tiene cliente? La misma demanda la hora del cliente. ¿Hay alguna? ¿Estaba negociación? Ahí debería poderse cambiar.

Ya empiezo a ingresarlo yo uno por uno y me vuelve más familiarizando, pero por qué le damos a los lores.

---

Ya, me hizo mi curso ahorita, así conmigo. Hasta mañana. Adiós, man.

---

¿Es con piquete o sin piquete? — Sí. ¿Es con piquete?

---

Pregunta. ¿Cuál es? Gastos por saco. Total por saco. ¿Se multiplica por sacos de 69 o por sacos de 46?

---

## Menú de Ingresos

El menú de ingresos tiene que tener:

- Embarque, qué posición
- El nombre del cliente, el número de contratos
- El estatus del contrato, si está fijado
- Negociación, eso
- Lote, Huewe, Santa Rosa
- Orgánico
- Puntuación
- Sacos de 69
- Sacos de 46
- Precio de bolsa en la mayor
- ¿Cuál es el diferencial?
- Gastos de exportación, ¿cuántos? Por saco
- Gastos de exportación son sobre 46 kilogramos

¿Estamos claros? — No.

- ¿Qué tasa de interés?
- ¿Cuántos meses de financiamiento?
- ¿Qué tipo de cambio?
- Precio de pergamino
- Quintales de rechazo
- Precio de rechazos
- Comisión sobre venta
- Comisión sobre compra
- Condiciones de pago
- Estatus
- Estatus de pago

Clarísimo. Entonces, esto es lo que yo tengo que ingresar.

---

## Resumen (Output)

Ahora, embarque. Eso es lo que te va a salir ya en el resumen aquí:

- Embarque
- En qué posición
- Cómo se llama el cliente
- El contrato
- El estatus
- Lote
- La puntuación
- Cuántos sacos de 69
- Cuántos sacos de 45
- Precio de bolsa
- Diferencial
- Total del precio
- Facturación en IVA
- Facturación en ingresos
- Gastos de exportación
- Total gastos de exportación
- Total gastos financieros
- Total venta de rechazos
- Total venta de prima
- Total comisión de ventas
- Total comisión de compras
- Utilidad bruta
- Margen bruto

Porque aquí lo ingresas y aquí te sale nada total. Es más que todo.

---

## Edición y Fijación

Ahora, esto es lo que vos quieres poder cambiar después. Ingresar — yo puedo cambiar una vez no esté fijado. Si no tengo que mover la fijación y decir negociación y ya lo muevo.

Pero aquí que es, esto que te hizo, entre ingresar — resumen no puedes tocar nada, porque eso es resultado de acá.

Sí, porque resumen, esto que te aparece aquí... O sea, así por ejemplo, voy ingresando uno por uno.

- Embarque: solo es pura información
- Posición: es pura información
- Cliente: es pura información
- Contrato: es pura información
- Estatus: es pura información

Yo pongo: negociación, fijado, no fijado. ¿Negociación o fijado? ¿Cuántas tenés en estatus?

---

## Estatus — Definición Final

Yo pondría: negociación, confirmado, no confirmado, y fijado.

Negociación es no confirmado, o sea así está. Y ahí confirmado no fijado, y confirmado fijado.

**Serían tres nada más:**

1. Negociación
2. Confirmado no fijado (si enviaste el contrato — ¿cuándo lo enviaste? Pues, confirmado)
3. Confirmado fijado

¿Estamos claros? — Estamos claros.

---

## Campos por Sección

### Embarque
Todos los meses: enero a diciembre.

### Posición
Enero, marzo, mayo, julio, septiembre, noviembre, diciembre. (Se salta uno siempre.)

### Año
Abierto. ¿Qué año estamos hablando? Cosecha, sería aquí.

### Cliente
Abierto (nombre del cliente).

### Contrato
Abierto.

### Estatus
Negociación, confirmado no fijado, confirmado fijado.

### Lote
Abierto (es un código, dejarla abierta para que uno lo escriba).

### Puntuación
Abierta.

### Sacos
De 46 — abierto. El de 69 es calculado (se multiplica por 1.5). Ese ni siquiera tendría que ir en ingresos, pero sí en el reporte.

### Precio de bolsa
Abierto.

### Diferencial
Abierto.

### Gastos de exportación
Abierto.

### Tasa de interés
Abierta.

### Meses de financiamiento
Abierto.

### Tipo de cambio
Abierto.

### Precio de pergamino
Abierto.

### Quintales de exportación
Abierto.

### Precio de rechazo
Abierto.

### Comisión sobre venta
Abierto (en dólares). Todos los precios son en dólares.

### Condiciones de pago
- CAD (Cash Against Documents)
- Crédito
- Meses de crédito: abierto

### Estatus de pago
Pagado / No pagado.

---

## Resumen — Campos Calculados

Si yo meto esto, me tienen que generar el resumen:

- Embarque: lo mismo
- Posición: lo mismo
- Si metes 46, ya te va a 69 kilos — correcto, eso es calculado
- Precio: total precio es formulado
- Facturación en IVA: fórmula
- Total gastos: fórmula
- Total gastos financieros: fórmula
- Total venta de rechazos: fórmula
- Total materia prima / pergamino: fórmula
- Utilidad bruta: fórmula
- Margen bruto: fórmula
- Condiciones de pago: fórmula
- Los que están en blanco son datos
- Estatus de pago: datos

---

Toma un screenshot y me lo mandas por WhatsApp. Y ahorita te voy a mandar porque le hiciste unos ajustes. Entonces mándame el Excel entero. Sí, comprátelo, ya lo vamos a mandar. Y volvemos a revisar mañana.

Seguimos, Jorge.

---

La parte que necesitamos avanzar ahorita no requiere el proyecto ahí adelante. ¿Listo? ¿Descansa?

---

La integración de todo lo que se caracteriza — ya me encontré como aplicar una vez el transporte, la rejección. Hay que activar la compra, la rejección. Ahora lo estuvimos viendo, aquí lo paths ya.

Aquí hay TV que cuestione alrededor de la propia. Estás creando, pero vamos a parar.
