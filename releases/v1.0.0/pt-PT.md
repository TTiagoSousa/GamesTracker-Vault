GamesTracker Vault 1.0.0 — a primeira versão pública

### Features
- **open source**: o projeto passa a chamar-se GamesTracker Vault, com a licença GNU AGPL-3.0, em github.com/TTiagoSousa/GamesTracker-Vault
- **docker**: uma imagem para amd64 e arm64, um ficheiro compose com PostgreSQL e um script de instalação num só comando; a página Versões avisa as instalações Docker quando há uma versão nova
- **android**: a app tem a mesma versão do servidor e avisa quando deixam de bater certo; aceita as autoridades de certificados que instalares no telemóvel (servidores com certificado próprio); uma build para o F-Droid sem atualização automática
- **estante**: uma estante por pessoa, com estados, horas, datas, nota, apontamentos e a plataforma onde jogaste
- **pesquisa**: todo o catálogo IGDB com filtros, e uma página para cada jogo
- **início**: um destaque com o que estás a jogar, prateleiras com setas e um jogo ao calhas
- **estatísticas**, o **assistente**, os **backups**, a **API** com tokens e três línguas

### Improvements
- **docs**: guias para Docker, Proxmox, configuração, domínios e HTTPS, a app Android, backups, atualizações e resolução de problemas
- **proxmox**: os containers que já existem passam para o repositório novo com um comando (deploy/proxmox/switch-repo.sh), com todos os dados
