Quieter updates

### Fixes
- **server**: updates and builds no longer stop for an interactive Prisma question (it closed by itself after 30 seconds, but held the update up)

### Improvements
- **docker**: every change is now tested by starting the real compose file with PostgreSQL before it can be released
- **security**: the code is scanned by GitHub CodeQL on every change
