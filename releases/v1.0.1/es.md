Actualizaciones sin interrupciones

### Fixes
- **servidor**: las actualizaciones y las builds ya no se paran en una pregunta de Prisma (se cerraba sola a los 30 segundos, pero retrasaba la actualización)

### Improvements
- **docker**: cada cambio se prueba arrancando el archivo compose real con PostgreSQL antes de poder salir en una versión
- **seguridad**: el código se analiza con GitHub CodeQL en cada cambio
