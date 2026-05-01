const { DataSource } = require('typeorm');
require('dotenv').config();

const myDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sems',
});

myDataSource.initialize()
  .then(async () => {
    const res = await myDataSource.query('SELECT * FROM scientific_product_types');
    console.log(res);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
