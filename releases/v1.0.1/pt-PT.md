Atualizações sem interrupções

### Fixes
- **servidor**: as atualizações e as builds já não param numa pergunta do Prisma (fechava sozinha ao fim de 30 segundos, mas atrasava a atualização)

### Improvements
- **docker**: cada alteração passa a ser testada arrancando o ficheiro compose real com PostgreSQL antes de poder sair numa versão
- **segurança**: o código é analisado pelo GitHub CodeQL em cada alteração
