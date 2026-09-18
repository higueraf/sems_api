import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { seedUniversities } from './universities.seed';
import { Country } from '../../entities/country.entity';
import { University } from '../../entities/university.entity';
import { Faculty } from '../../entities/faculty.entity';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'sems_db',
  entities: [Country, University, Faculty],
  synchronize: true,
});

async function run() {
  await dataSource.initialize();
  console.log('📦 Database connected. Sembrando universidades...\n');
  await seedUniversities(dataSource);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Seed de universidades falló:', err);
  process.exit(1);
});
