# POS System Backend

Node.js/Express backend with Drizzle ORM and MySQL for the POS system.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create a `.env` file with:
   ```env
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=pos_system
   ```

3. **Setup database:**
   ```bash
   npm run db:setup
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:setup` - Import schema.sql into MySQL
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run Drizzle migrations
- `npm run db:studio` - Open Drizzle Studio

## API Endpoints

- `GET /health` - Health check
- `GET /api` - API information

## Database

The backend uses Drizzle ORM with MySQL. The schema is defined in `src/db/schema.js` and imported from `schema.sql`.

