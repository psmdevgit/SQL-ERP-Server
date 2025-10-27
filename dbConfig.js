// dbConfig.js
const sql = require("mssql");

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER, // e.g., 'localhost'
  database: process.env.SQL_DATABASE,
 options: {
  encrypt: true,
  trustServerCertificate: true,
  serverName: process.env.SQL_SERVER // Add this line if using IP
}
};

sql.connect(config)
  .then(() => console.log("✅ Connected to MSSQL"))
  .catch(err => console.error("❌ SQL Connection Failed:", err));
  
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("Connected to MSSQL");
    return pool;
  })
  .catch(err => {
    console.error("Database Connection Failed! Bad Config: ", err);
    throw err;
  });

module.exports = {
  sql,
  poolPromise
};
