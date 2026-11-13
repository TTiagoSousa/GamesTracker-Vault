import { pgEnv } from './pgDump';

describe('pgEnv', () => {
  it('splits DATABASE_URL into the PG* variables', () => {
    expect(
      pgEnv('postgresql://gametracker:s3cret@127.0.0.1:5432/gametracker'),
    ).toEqual({
      PGHOST: '127.0.0.1',
      PGPORT: '5432',
      PGUSER: 'gametracker',
      PGPASSWORD: 's3cret',
      PGDATABASE: 'gametracker',
    });
  });

  it('decodes escaped characters and keeps sslmode', () => {
    const env = pgEnv(
      'postgresql://user:p%40ss%2Fword@db.local/my-db?sslmode=require',
    );
    expect(env.PGPASSWORD).toBe('p@ss/word');
    expect(env.PGPORT).toBe('5432');
    expect(env.PGDATABASE).toBe('my-db');
    expect(env.PGSSLMODE).toBe('require');
  });
});
