import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create a database dump using Node.js MySQL connection
 * @param {string} outputPath - Full path where the dump file should be saved
 * @param {string} identificador - Identifier to use in filename
 * @returns {Promise<{filename: string, filePath: string, fileSize: number}>}
 */
export async function createDatabaseDump(outputPath, identificador) {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'pos_system';
  const dbPort = Number(process.env.DB_PORT) || 3306;

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .substring(0, 19); // YYYY-MM-DD_HH-MM-SS
  
  const filename = `${identificador}_${timestamp}.sql`;
  const filePath = path.join(outputPath, filename);

  // Ensure output directory exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  let connection;
  let writeStream;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      multipleStatements: true,
    });

    // Create write stream for backup file
    writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

    // Write SQL header
    writeStream.write(`-- MySQL dump created on ${new Date().toISOString()}\n`);
    writeStream.write(`-- Database: ${dbName}\n`);
    writeStream.write(`SET NAMES utf8mb4;\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS=0;\n\n`);

    // Get all tables
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [dbName]
    );

    // Dump each table
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      // Get table structure
      const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
      writeStream.write(`\n-- Table structure for table \`${tableName}\`\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
      writeStream.write(`${createTable[0]['Create Table']};\n\n`);

      // Get table data
      const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        writeStream.write(`-- Dumping data for table \`${tableName}\`\n`);
        writeStream.write(`LOCK TABLES \`${tableName}\` WRITE;\n`);
        writeStream.write(`/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`);

        // Write INSERT statements in batches
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = batch.map(row => {
            const rowValues = Object.values(row).map(val => {
              if (val === null) return 'NULL';
              if (typeof val === 'string') {
                return `'${val.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
              }
              return val;
            });
            return `(${rowValues.join(',')})`;
          }).join(',\n');
          
          writeStream.write(`INSERT INTO \`${tableName}\` VALUES ${values};\n`);
        }

        writeStream.write(`/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`);
        writeStream.write(`UNLOCK TABLES;\n\n`);
      }
    }

    // Get stored procedures, functions, and triggers
    const [procedures] = await connection.execute(
      `SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION 
       FROM INFORMATION_SCHEMA.ROUTINES 
       WHERE ROUTINE_SCHEMA = ?`,
      [dbName]
    );

    if (procedures.length > 0) {
      writeStream.write(`\n-- Stored procedures and functions\n`);
      for (const proc of procedures) {
        const [createProc] = await connection.execute(
          `SHOW CREATE ${proc.ROUTINE_TYPE} \`${proc.ROUTINE_NAME}\``
        );
        writeStream.write(`\n${createProc[0][`Create ${proc.ROUTINE_TYPE}`]};\n`);
      }
    }

    // Get triggers
    const [triggers] = await connection.execute(
      `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT 
       FROM INFORMATION_SCHEMA.TRIGGERS 
       WHERE TRIGGER_SCHEMA = ?`,
      [dbName]
    );

    if (triggers.length > 0) {
      writeStream.write(`\n-- Triggers\n`);
      for (const trigger of triggers) {
        const [createTrigger] = await connection.execute(
          `SHOW CREATE TRIGGER \`${trigger.TRIGGER_NAME}\``
        );
        writeStream.write(`\n${createTrigger[0]['SQL Original Statement']};\n`);
      }
    }

    // Write footer
    writeStream.write(`\nSET FOREIGN_KEY_CHECKS=1;\n`);
    writeStream.end();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Verify file was created and get size
    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file was not created');
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    if (fileSize === 0) {
      throw new Error('Backup file is empty');
    }

    return {
      filename,
      filePath,
      fileSize,
    };
  } catch (error) {
    // Clean up empty file if it exists
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
    }

    throw new Error(`Failed to create database dump: ${error.message}`);
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
}

