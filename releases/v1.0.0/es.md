GamesTracker Vault 1.0.0 — la primera versión pública

### Features
- **open source**: el proyecto pasa a llamarse GamesTracker Vault, con la licencia GNU AGPL-3.0, en github.com/TTiagoSousa/GamesTracker-Vault
- **docker**: una imagen para amd64 y arm64, un archivo compose con PostgreSQL y un script de instalación en un solo comando; la página Versiones avisa a las instalaciones Docker cuando hay una versión nueva
- **android**: la app tiene la misma versión que el servidor y avisa cuando dejan de coincidir; acepta las autoridades de certificados que instales en el móvil (servidores con certificado propio); una build para F-Droid sin actualización automática
- **estantería**: una estantería por persona, con estados, horas, fechas, nota, apuntes y la plataforma en la que jugaste
- **búsqueda**: todo el catálogo IGDB con filtros, y una página para cada juego
- **inicio**: un destacado con lo que estás jugando, estanterías con flechas y un juego al azar
- **estadísticas**, el **asistente**, las **copias de seguridad**, la **API** con tokens y tres idiomas

### Improvements
- **docs**: guías para Docker, Proxmox, configuración, dominios y HTTPS, la app Android, copias de seguridad, actualizaciones y solución de problemas
- **proxmox**: los contenedores que ya existen pasan al repositorio nuevo con un comando (deploy/proxmox/switch-repo.sh), con todos sus datos
